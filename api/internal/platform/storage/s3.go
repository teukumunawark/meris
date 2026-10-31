package storage

import (
	"bytes"
	"cmp"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	unsignedPayload = "UNSIGNED-PAYLOAD"
	defaultRegion   = "us-east-1"
	defaultPresign  = 24 * time.Hour
)

type Config struct {
	Endpoint       string
	PublicEndpoint string
	AccessKey      string
	SecretKey      string
	Bucket         string
	Region         string
	PresignExpiry  time.Duration
}

type Client struct {
	endpoint       *url.URL
	publicEndpoint *url.URL
	accessKey      string
	secretKey      string
	bucket         string
	region         string
	presignExpiry  time.Duration
	httpClient     *http.Client
	nowFn          func() time.Time
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		return nil, nil
	}
	if strings.TrimSpace(cfg.AccessKey) == "" || strings.TrimSpace(cfg.SecretKey) == "" {
		return nil, fmt.Errorf("storage access key and secret key are required when S3_ENDPOINT is set")
	}
	if strings.TrimSpace(cfg.Bucket) == "" {
		cfg.Bucket = "meris-receipts"
	}

	ep, err := url.Parse(strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/"))
	if err != nil || ep.Scheme == "" || ep.Host == "" {
		return nil, fmt.Errorf("invalid S3_ENDPOINT %q", cfg.Endpoint)
	}

	pubRaw := cmp.Or(strings.TrimSpace(cfg.PublicEndpoint), strings.TrimSpace(cfg.Endpoint))
	pubEp, err := url.Parse(strings.TrimRight(pubRaw, "/"))
	if err != nil || pubEp.Scheme == "" || pubEp.Host == "" {
		return nil, fmt.Errorf("invalid S3_PUBLIC_ENDPOINT %q", cfg.PublicEndpoint)
	}

	region := cmp.Or(strings.TrimSpace(cfg.Region), defaultRegion)
	expiry := cfg.PresignExpiry
	if expiry <= 0 {
		expiry = defaultPresign
	}

	return &Client{
		endpoint:       ep,
		publicEndpoint: pubEp,
		accessKey:      strings.TrimSpace(cfg.AccessKey),
		secretKey:      strings.TrimSpace(cfg.SecretKey),
		bucket:         strings.TrimSpace(cfg.Bucket),
		region:         region,
		presignExpiry:  expiry,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		nowFn: time.Now,
	}, nil
}

func (c *Client) EnsureBucket(ctx context.Context) error {
	if c == nil {
		return nil
	}

	headReq, err := c.newSignedRequest(ctx, http.MethodHead, "/"+c.bucket, nil, "")
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(headReq)
	if err != nil {
		return fmt.Errorf("check bucket %s: %w", c.bucket, err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}
	if resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("check bucket %s returned status %d", c.bucket, resp.StatusCode)
	}

	putReq, err := c.newSignedRequest(ctx, http.MethodPut, "/"+c.bucket, nil, "")
	if err != nil {
		return err
	}
	putResp, err := c.httpClient.Do(putReq)
	if err != nil {
		return fmt.Errorf("create bucket %s: %w", c.bucket, err)
	}
	defer func() { _ = putResp.Body.Close() }()

	if putResp.StatusCode != http.StatusOK && putResp.StatusCode != http.StatusCreated && putResp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(io.LimitReader(putResp.Body, 1024))
		return fmt.Errorf("create bucket %s returned status %d: %s", c.bucket, putResp.StatusCode, string(body))
	}
	return nil
}

func ReceiptImageHashAndKey(imageBytes []byte) (sha256Hex string, imageKey string, contentType string) {
	sum := sha256.Sum256(imageBytes)
	sha256Hex = hex.EncodeToString(sum[:])

	contentType = http.DetectContentType(imageBytes)
	ext := extensionForContentType(contentType)
	imageKey = fmt.Sprintf("receipts/%s%s", sha256Hex, ext)
	return sha256Hex, imageKey, contentType
}

func extensionForContentType(contentType string) string {
	switch {
	case strings.HasPrefix(contentType, "image/png"):
		return ".png"
	case strings.HasPrefix(contentType, "image/webp"):
		return ".webp"
	case strings.HasPrefix(contentType, "image/gif"):
		return ".gif"
	default:
		return ".jpg"
	}
}

func (c *Client) UploadReceipt(ctx context.Context, imageBytes []byte) (string, string, error) {
	sha256Hex, imageKey, contentType := ReceiptImageHashAndKey(imageBytes)
	if c == nil {
		return "", sha256Hex, nil
	}

	objectPath := "/" + c.bucket + "/" + strings.TrimLeft(imageKey, "/")
	req, err := c.newSignedRequest(ctx, http.MethodPut, objectPath, imageBytes, contentType)
	if err != nil {
		return "", sha256Hex, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", sha256Hex, fmt.Errorf("upload receipt %s: %w", imageKey, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", sha256Hex, fmt.Errorf("upload receipt %s failed with status %d: %s", imageKey, resp.StatusCode, string(body))
	}

	return imageKey, sha256Hex, nil
}

func (c *Client) GetReceipt(ctx context.Context, imageKey string) ([]byte, error) {
	if c == nil || strings.TrimSpace(imageKey) == "" {
		return nil, fmt.Errorf("receipt image is not stored")
	}

	objectPath := "/" + c.bucket + "/" + strings.TrimLeft(imageKey, "/")
	req, err := c.newSignedRequest(ctx, http.MethodGet, objectPath, nil, "")
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download receipt %s: %w", imageKey, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("download receipt %s failed with status %d: %s", imageKey, resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func (c *Client) PresignReceiptURL(imageKey string) string {
	if c == nil || strings.TrimSpace(imageKey) == "" {
		return ""
	}

	now := c.nowFn().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	basePath := strings.TrimRight(c.publicEndpoint.Path, "/")
	canonicalURI := basePath + "/" + c.bucket + "/" + strings.TrimLeft(imageKey, "/")

	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, c.region)
	credential := c.accessKey + "/" + credentialScope
	expiresSec := strconv.Itoa(int(c.presignExpiry.Seconds()))

	queryParams := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    credential,
		"X-Amz-Date":          amzDate,
		"X-Amz-Expires":       expiresSec,
		"X-Amz-SignedHeaders": "host",
	}

	canonicalQuery := encodeCanonicalQuery(queryParams)
	host := c.publicEndpoint.Host

	canonicalRequest := strings.Join([]string{
		http.MethodGet,
		canonicalURI,
		canonicalQuery,
		"host:" + host + "\n",
		"host",
		unsignedPayload,
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256HexString([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(c.secretKey, dateStamp, c.region, "s3")
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	return fmt.Sprintf("%s://%s%s?%s&X-Amz-Signature=%s",
		c.publicEndpoint.Scheme,
		host,
		canonicalURI,
		canonicalQuery,
		signature,
	)
}

func (c *Client) newSignedRequest(ctx context.Context, method, objectPath string, payload []byte, contentType string) (*http.Request, error) {
	now := c.nowFn().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	basePath := strings.TrimRight(c.endpoint.Path, "/")
	canonicalURI := basePath + objectPath
	targetURL := fmt.Sprintf("%s://%s%s", c.endpoint.Scheme, c.endpoint.Host, canonicalURI)

	payloadHash := sha256HexString(payload)
	req, err := http.NewRequestWithContext(ctx, method, targetURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	host := c.endpoint.Host
	req.Host = host
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n", host, payloadHash, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	canonicalRequest := strings.Join([]string{
		method,
		canonicalURI,
		"",
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, c.region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256HexString([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(c.secretKey, dateStamp, c.region, "s3")
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKey,
		credentialScope,
		signedHeaders,
		signature,
	)
	req.Header.Set("Authorization", authHeader)

	return req, nil
}

func encodeCanonicalQuery(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, awsQueryEscape(k)+"="+awsQueryEscape(params[k]))
	}
	return strings.Join(parts, "&")
}

func awsQueryEscape(s string) string {
	escaped := url.QueryEscape(s)
	return strings.ReplaceAll(escaped, "+", "%20")
}

func deriveSigningKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(data)
	return mac.Sum(nil)
}

func sha256HexString(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
