/**
 * S3 Document Service Integration Tests
 *
 * Tests for the S3DocumentService covering:
 * - Document upload (regular and trade secrets buckets)
 * - Document download with metadata extraction
 * - Presigned URL generation (upload and download)
 * - Document deletion
 * - Document listing by asset
 * - Document copying between assets
 * - Document existence checking
 * - Error handling scenarios
 *
 * @module test/integration/aws
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterEach } from 'vitest';
import type { DocumentMetadata, UploadOptions } from '../../../src/infrastructure/aws/s3-document-service.js';

// Store mock function references at module level
let mockSend: Mock;
let mockGetSignedUrl: Mock;

// Store command constructor mock references
let MockPutObjectCommand: Mock;
let MockGetObjectCommand: Mock;
let MockDeleteObjectCommand: Mock;
let MockListObjectsV2Command: Mock;
let MockCopyObjectCommand: Mock;
let MockHeadObjectCommand: Mock;

// Mock the AWS SDK modules before imports
vi.mock('@aws-sdk/client-s3', async () => {
  mockSend = vi.fn();

  // Create command mocks that capture constructor arguments
  MockPutObjectCommand = vi.fn().mockImplementation((input) => ({ ...input, _type: 'PutObjectCommand' }));
  MockGetObjectCommand = vi.fn().mockImplementation((input) => ({ ...input, _type: 'GetObjectCommand' }));
  MockDeleteObjectCommand = vi.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObjectCommand' }));
  MockListObjectsV2Command = vi.fn().mockImplementation((input) => ({ ...input, _type: 'ListObjectsV2Command' }));
  MockCopyObjectCommand = vi.fn().mockImplementation((input) => ({ ...input, _type: 'CopyObjectCommand' }));
  MockHeadObjectCommand = vi.fn().mockImplementation((input) => ({ ...input, _type: 'HeadObjectCommand' }));

  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
    ListObjectsV2Command: MockListObjectsV2Command,
    CopyObjectCommand: MockCopyObjectCommand,
    HeadObjectCommand: MockHeadObjectCommand,
  };
});

vi.mock('@aws-sdk/s3-request-presigner', async () => {
  mockGetSignedUrl = vi.fn();
  return {
    getSignedUrl: mockGetSignedUrl,
  };
});

// Import after mocks are set up
const { S3DocumentService } = await import('../../../src/infrastructure/aws/s3-document-service.js');

describe('S3DocumentService', () => {
  let service: S3DocumentService;

  // Test configuration
  const testConfig = {
    documentsBucket: 'test-ip-documents-bucket',
    tradeSecretsBucket: 'test-ip-trade-secrets-bucket',
    documentsKeyId: 'alias/test-documents-key',
    tradeSecretsKeyId: 'alias/test-trade-secrets-key',
  };

  // Sample document metadata
  const createTestMetadata = (
    assetType: DocumentMetadata['assetType'] = 'patent'
  ): Omit<DocumentMetadata, 'uploadedAt' | 'sizeBytes'> => ({
    documentId: 'doc-12345',
    assetType,
    assetId: 'asset-67890',
    fileName: 'patent-application.pdf',
    mimeType: 'application/pdf',
    uploadedBy: 'user-001',
    classification: 'confidential',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new S3DocumentService(testConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // UPLOAD DOCUMENT TESTS
  // ===========================================================================

  describe('uploadDocument', () => {
    describe('regular documents bucket', () => {
      it('should upload document to documents bucket with KMS encryption', async () => {
        // Arrange
        const content = Buffer.from('test document content');
        const metadata = createTestMetadata('patent');
        const options: UploadOptions = {
          classification: 'confidential',
          tags: { project: 'alpha', department: 'legal' },
        };

        mockSend.mockResolvedValueOnce({});

        // Act
        const result = await service.uploadDocument(content, metadata, options);

        // Assert
        expect(mockSend).toHaveBeenCalledTimes(1);

        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand).toMatchObject({
          Bucket: testConfig.documentsBucket,
          Key: 'patent/asset-67890/doc-12345/patent-application.pdf',
          Body: content,
          ContentType: 'application/pdf',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: testConfig.documentsKeyId,
        });

        // Verify metadata was set
        expect(putCommand.Metadata).toMatchObject({
          'x-amz-meta-document-id': 'doc-12345',
          'x-amz-meta-asset-type': 'patent',
          'x-amz-meta-asset-id': 'asset-67890',
          'x-amz-meta-uploaded-by': 'user-001',
          'x-amz-meta-classification': 'confidential',
          'x-amz-meta-tag-project': 'alpha',
          'x-amz-meta-tag-department': 'legal',
        });

        // Verify returned metadata
        expect(result.documentId).toBe('doc-12345');
        expect(result.assetType).toBe('patent');
        expect(result.sizeBytes).toBe(content.length);
        expect(result.uploadedAt).toBeInstanceOf(Date);
        expect(result.classification).toBe('confidential');
        expect(result.tags).toEqual({ project: 'alpha', department: 'legal' });
      });

      it('should upload trademark document to documents bucket', async () => {
        // Arrange
        const content = Buffer.from('trademark logo image data');
        const metadata = createTestMetadata('trademark');
        metadata.mimeType = 'image/png';
        metadata.fileName = 'logo.png';

        mockSend.mockResolvedValueOnce({});

        // Act
        await service.uploadDocument(content, metadata);

        // Assert
        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand.Bucket).toBe(testConfig.documentsBucket);
        expect(putCommand.Key).toBe('trademark/asset-67890/doc-12345/logo.png');
        expect(putCommand.ContentType).toBe('image/png');
        expect(putCommand.SSEKMSKeyId).toBe(testConfig.documentsKeyId);
      });

      it('should set default classification to internal when not specified', async () => {
        // Arrange
        const content = Buffer.from('document content');
        const metadata = createTestMetadata('domain');
        delete (metadata as any).classification;

        mockSend.mockResolvedValueOnce({});

        // Act
        const result = await service.uploadDocument(content, metadata);

        // Assert
        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand.Metadata['x-amz-meta-classification']).toBe('internal');
        expect(result.classification).toBe('internal');
      });

      it('should include checksum in metadata when provided', async () => {
        // Arrange
        const content = Buffer.from('document content');
        const metadata = {
          ...createTestMetadata('license'),
          checksum: 'sha256:abc123def456',
        };

        mockSend.mockResolvedValueOnce({});

        // Act
        await service.uploadDocument(content, metadata);

        // Assert
        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand.Metadata['x-amz-meta-checksum']).toBe('sha256:abc123def456');
      });

      it('should set custom content disposition when provided', async () => {
        // Arrange
        const content = Buffer.from('document content');
        const metadata = createTestMetadata('general');
        const options: UploadOptions = {
          contentDisposition: 'inline; filename="view-document.pdf"',
        };

        mockSend.mockResolvedValueOnce({});

        // Act
        await service.uploadDocument(content, metadata, options);

        // Assert
        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand.ContentDisposition).toBe('inline; filename="view-document.pdf"');
      });
    });

    describe('trade secrets bucket', () => {
      it('should upload trade secret to separate bucket with different KMS key', async () => {
        // Arrange
        const content = Buffer.from('highly confidential trade secret data');
        const metadata = createTestMetadata('trade_secret');
        const options: UploadOptions = {
          classification: 'restricted',
        };

        mockSend.mockResolvedValueOnce({});

        // Act
        const result = await service.uploadDocument(content, metadata, options);

        // Assert
        const putCommand = MockPutObjectCommand.mock.calls[0][0];

        // Should use trade secrets bucket
        expect(putCommand.Bucket).toBe(testConfig.tradeSecretsBucket);

        // Should use trade secrets KMS key
        expect(putCommand.SSEKMSKeyId).toBe(testConfig.tradeSecretsKeyId);

        // Should have private ACL
        expect(putCommand.ACL).toBe('private');

        // Verify key path
        expect(putCommand.Key).toBe('trade_secret/asset-67890/doc-12345/patent-application.pdf');

        // Verify result
        expect(result.assetType).toBe('trade_secret');
        expect(result.classification).toBe('restricted');
      });

      it('should set private ACL only for trade secrets', async () => {
        // Test regular document (should NOT have ACL)
        mockSend.mockResolvedValueOnce({});
        await service.uploadDocument(Buffer.from('regular document'), createTestMetadata('patent'));
        const regularPutCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(regularPutCommand.ACL).toBeUndefined();

        vi.clearAllMocks();

        // Test trade secret (SHOULD have ACL)
        mockSend.mockResolvedValueOnce({});
        await service.uploadDocument(Buffer.from('secret document'), createTestMetadata('trade_secret'));
        const secretPutCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(secretPutCommand.ACL).toBe('private');
      });
    });
  });

  // ===========================================================================
  // DOWNLOAD DOCUMENT TESTS
  // ===========================================================================

  describe('downloadDocument', () => {
    it('should download document with metadata extraction', async () => {
      // Arrange
      const mockBody = {
        transformToWebStream: vi.fn().mockReturnValue(new ReadableStream()),
      };
      const mockResponse = {
        Body: mockBody,
        ContentType: 'application/pdf',
        ContentLength: 1024,
        LastModified: new Date('2024-01-15T10:00:00Z'),
        Metadata: {
          'document-id': 'doc-12345',
          'uploaded-by': 'user-001',
          'classification': 'confidential',
          'checksum': 'sha256:abc123',
        },
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await service.downloadDocument(
        'patent',
        'asset-67890',
        'doc-12345',
        'patent-application.pdf'
      );

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const getCommand = MockGetObjectCommand.mock.calls[0][0];
      expect(getCommand).toMatchObject({
        Bucket: testConfig.documentsBucket,
        Key: 'patent/asset-67890/doc-12345/patent-application.pdf',
      });

      // Verify returned data
      expect(result.contentType).toBe('application/pdf');
      expect(result.contentLength).toBe(1024);
      expect(result.metadata.documentId).toBe('doc-12345');
      expect(result.metadata.uploadedBy).toBe('user-001');
      expect(result.metadata.classification).toBe('confidential');
      expect(result.metadata.checksum).toBe('sha256:abc123');
      expect(result.metadata.assetType).toBe('patent');
      expect(result.metadata.assetId).toBe('asset-67890');
    });

    it('should download trade secret from trade secrets bucket', async () => {
      // Arrange
      const mockBody = {
        transformToWebStream: vi.fn().mockReturnValue(new ReadableStream()),
      };
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: 'text/plain',
        ContentLength: 512,
        LastModified: new Date(),
        Metadata: {},
      });

      // Act
      await service.downloadDocument(
        'trade_secret',
        'secret-asset-001',
        'doc-secret-001',
        'secret-formula.txt'
      );

      // Assert
      const getCommand = MockGetObjectCommand.mock.calls[0][0];
      expect(getCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
      expect(getCommand.Key).toBe('trade_secret/secret-asset-001/doc-secret-001/secret-formula.txt');
    });

    it('should handle missing metadata gracefully', async () => {
      // Arrange
      const mockBody = {
        transformToWebStream: vi.fn().mockReturnValue(new ReadableStream()),
      };
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: undefined,
        ContentLength: undefined,
        LastModified: undefined,
        Metadata: undefined,
      });

      // Act
      const result = await service.downloadDocument(
        'trademark',
        'asset-001',
        'doc-001',
        'logo.png'
      );

      // Assert
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.contentLength).toBe(0);
      expect(result.metadata.uploadedBy).toBe('unknown');
      expect(result.metadata.documentId).toBe('doc-001');
    });

    it('should return document body as web stream', async () => {
      // Arrange
      const mockStream = new ReadableStream();
      const mockBody = {
        transformToWebStream: vi.fn().mockReturnValue(mockStream),
      };
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ContentType: 'application/pdf',
        ContentLength: 2048,
        Metadata: {},
      });

      // Act
      const result = await service.downloadDocument(
        'patent',
        'asset-001',
        'doc-001',
        'file.pdf'
      );

      // Assert
      expect(mockBody.transformToWebStream).toHaveBeenCalled();
      expect(result.body).toBe(mockStream);
    });
  });

  // ===========================================================================
  // PRESIGNED URL TESTS
  // ===========================================================================

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned download URL with default expiration', async () => {
      // Arrange
      const expectedUrl = 'https://s3.amazonaws.com/bucket/key?signature=abc123';
      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      // Act
      const result = await service.getPresignedDownloadUrl(
        'patent',
        'asset-001',
        'doc-001',
        'document.pdf'
      );

      // Assert
      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

      const [_client, _command, options] = mockGetSignedUrl.mock.calls[0];
      expect(options.expiresIn).toBe(3600); // Default 1 hour
    });

    it('should generate presigned download URL with custom expiration', async () => {
      // Arrange
      const expectedUrl = 'https://presigned-url.example.com';
      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      // Act
      const result = await service.getPresignedDownloadUrl(
        'trademark',
        'asset-002',
        'doc-002',
        'logo.png',
        7200 // 2 hours
      );

      // Assert
      expect(result).toBe(expectedUrl);
      const [_client, _command, options] = mockGetSignedUrl.mock.calls[0];
      expect(options.expiresIn).toBe(7200);
    });

    it('should use trade secrets bucket for trade secret downloads', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValueOnce('https://presigned-url.example.com');

      // Act
      await service.getPresignedDownloadUrl(
        'trade_secret',
        'secret-asset',
        'secret-doc',
        'secret.txt'
      );

      // Assert
      const getCommand = MockGetObjectCommand.mock.calls[0][0];
      expect(getCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
    });

    it('should include content disposition for download', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValueOnce('https://presigned-url.example.com');

      // Act
      await service.getPresignedDownloadUrl(
        'patent',
        'asset-001',
        'doc-001',
        'report.pdf'
      );

      // Assert
      const getCommand = MockGetObjectCommand.mock.calls[0][0];
      expect(getCommand.ResponseContentDisposition).toBe('attachment; filename="report.pdf"');
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate presigned upload URL with KMS encryption', async () => {
      // Arrange
      const expectedUrl = 'https://s3.amazonaws.com/bucket/key?upload-signature=xyz789';
      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      // Act
      const result = await service.getPresignedUploadUrl(
        'patent',
        'asset-001',
        'doc-001',
        'new-document.pdf',
        'application/pdf'
      );

      // Assert
      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

      const putCommand = MockPutObjectCommand.mock.calls[0][0];
      expect(putCommand).toMatchObject({
        Bucket: testConfig.documentsBucket,
        Key: 'patent/asset-001/doc-001/new-document.pdf',
        ContentType: 'application/pdf',
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: testConfig.documentsKeyId,
      });
    });

    it('should use trade secrets bucket and key for trade secret uploads', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValueOnce('https://presigned-upload.example.com');

      // Act
      await service.getPresignedUploadUrl(
        'trade_secret',
        'secret-asset',
        'secret-doc',
        'confidential.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      // Assert
      const putCommand = MockPutObjectCommand.mock.calls[0][0];
      expect(putCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
      expect(putCommand.SSEKMSKeyId).toBe(testConfig.tradeSecretsKeyId);
    });

    it('should generate presigned upload URL with custom expiration', async () => {
      // Arrange
      mockGetSignedUrl.mockResolvedValueOnce('https://presigned-url.example.com');

      // Act
      await service.getPresignedUploadUrl(
        'domain',
        'asset-003',
        'doc-003',
        'certificate.pdf',
        'application/pdf',
        1800 // 30 minutes
      );

      // Assert
      const [_client, _command, options] = mockGetSignedUrl.mock.calls[0];
      expect(options.expiresIn).toBe(1800);
    });
  });

  // ===========================================================================
  // DELETE DOCUMENT TESTS
  // ===========================================================================

  describe('deleteDocument', () => {
    it('should delete document from documents bucket', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.deleteDocument(
        'patent',
        'asset-001',
        'doc-001',
        'old-document.pdf'
      );

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const deleteCommand = MockDeleteObjectCommand.mock.calls[0][0];
      expect(deleteCommand).toMatchObject({
        Bucket: testConfig.documentsBucket,
        Key: 'patent/asset-001/doc-001/old-document.pdf',
      });
    });

    it('should delete trade secret from trade secrets bucket', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.deleteDocument(
        'trade_secret',
        'secret-asset',
        'secret-doc',
        'deleted-secret.txt'
      );

      // Assert
      const deleteCommand = MockDeleteObjectCommand.mock.calls[0][0];
      expect(deleteCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
      expect(deleteCommand.Key).toBe('trade_secret/secret-asset/secret-doc/deleted-secret.txt');
    });

    it('should delete different asset types correctly', async () => {
      // Test various asset types
      const assetTypes: Array<DocumentMetadata['assetType']> = [
        'patent',
        'trademark',
        'domain',
        'license',
        'general',
      ];

      for (const assetType of assetTypes) {
        vi.clearAllMocks();
        mockSend.mockResolvedValueOnce({});

        await service.deleteDocument(assetType, 'asset-id', 'doc-id', 'file.txt');

        const deleteCommand = MockDeleteObjectCommand.mock.calls[0][0];
        expect(deleteCommand.Bucket).toBe(testConfig.documentsBucket);
        expect(deleteCommand.Key).toBe(`${assetType}/asset-id/doc-id/file.txt`);
      }
    });
  });

  // ===========================================================================
  // LIST DOCUMENTS TESTS
  // ===========================================================================

  describe('listDocuments', () => {
    it('should list documents for an asset with default max results', async () => {
      // Arrange
      const mockContents = [
        { Key: 'patent/asset-001/doc-001/file1.pdf', Size: 1024, LastModified: new Date('2024-01-01') },
        { Key: 'patent/asset-001/doc-002/file2.pdf', Size: 2048, LastModified: new Date('2024-01-02') },
        { Key: 'patent/asset-001/doc-003/file3.pdf', Size: 3072, LastModified: new Date('2024-01-03') },
      ];
      mockSend.mockResolvedValueOnce({ Contents: mockContents });

      // Act
      const result = await service.listDocuments('patent', 'asset-001');

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const listCommand = MockListObjectsV2Command.mock.calls[0][0];
      expect(listCommand).toMatchObject({
        Bucket: testConfig.documentsBucket,
        Prefix: 'patent/asset-001/',
        MaxKeys: 100, // Default
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        key: 'patent/asset-001/doc-001/file1.pdf',
        size: 1024,
      });
      expect(result[0].lastModified).toEqual(new Date('2024-01-01'));
    });

    it('should list documents with custom max results', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({ Contents: [] });

      // Act
      await service.listDocuments('trademark', 'tm-asset-001', 50);

      // Assert
      const listCommand = MockListObjectsV2Command.mock.calls[0][0];
      expect(listCommand.MaxKeys).toBe(50);
    });

    it('should list trade secrets from trade secrets bucket', async () => {
      // Arrange
      const mockContents = [
        { Key: 'trade_secret/secret-001/doc-001/secret.txt', Size: 512, LastModified: new Date() },
      ];
      mockSend.mockResolvedValueOnce({ Contents: mockContents });

      // Act
      const result = await service.listDocuments('trade_secret', 'secret-001');

      // Assert
      const listCommand = MockListObjectsV2Command.mock.calls[0][0];
      expect(listCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
      expect(listCommand.Prefix).toBe('trade_secret/secret-001/');
      expect(result).toHaveLength(1);
    });

    it('should handle empty contents gracefully', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({ Contents: undefined });

      // Act
      const result = await service.listDocuments('domain', 'domain-asset-001');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle items with missing properties', async () => {
      // Arrange
      const mockContents = [
        { Key: undefined, Size: undefined, LastModified: undefined },
        { Key: 'valid/key', Size: 100, LastModified: new Date('2024-06-01') },
      ];
      mockSend.mockResolvedValueOnce({ Contents: mockContents });

      // Act
      const result = await service.listDocuments('license', 'license-001');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('');
      expect(result[0].size).toBe(0);
      expect(result[1].key).toBe('valid/key');
      expect(result[1].size).toBe(100);
    });
  });

  // ===========================================================================
  // COPY DOCUMENT TESTS
  // ===========================================================================

  describe('copyDocument', () => {
    it('should copy document within same bucket', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.copyDocument(
        'patent', 'source-asset', 'source-doc', 'source.pdf',
        'patent', 'dest-asset', 'dest-doc', 'dest.pdf'
      );

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const copyCommand = MockCopyObjectCommand.mock.calls[0][0];
      expect(copyCommand).toMatchObject({
        CopySource: `${testConfig.documentsBucket}/patent/source-asset/source-doc/source.pdf`,
        Bucket: testConfig.documentsBucket,
        Key: 'patent/dest-asset/dest-doc/dest.pdf',
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: testConfig.documentsKeyId,
      });
    });

    it('should copy document from documents bucket to trade secrets bucket', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.copyDocument(
        'patent', 'patent-asset', 'patent-doc', 'original.pdf',
        'trade_secret', 'secret-asset', 'secret-doc', 'promoted.pdf'
      );

      // Assert
      const copyCommand = MockCopyObjectCommand.mock.calls[0][0];
      expect(copyCommand.CopySource).toBe(
        `${testConfig.documentsBucket}/patent/patent-asset/patent-doc/original.pdf`
      );
      expect(copyCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
      expect(copyCommand.SSEKMSKeyId).toBe(testConfig.tradeSecretsKeyId);
    });

    it('should copy document from trade secrets bucket to documents bucket', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.copyDocument(
        'trade_secret', 'secret-asset', 'secret-doc', 'declassified.pdf',
        'patent', 'patent-asset', 'patent-doc', 'public.pdf'
      );

      // Assert
      const copyCommand = MockCopyObjectCommand.mock.calls[0][0];
      expect(copyCommand.CopySource).toBe(
        `${testConfig.tradeSecretsBucket}/trade_secret/secret-asset/secret-doc/declassified.pdf`
      );
      expect(copyCommand.Bucket).toBe(testConfig.documentsBucket);
      expect(copyCommand.SSEKMSKeyId).toBe(testConfig.documentsKeyId);
    });

    it('should copy document between different asset types', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.copyDocument(
        'trademark', 'tm-asset', 'tm-doc', 'logo.png',
        'license', 'license-asset', 'license-doc', 'licensed-logo.png'
      );

      // Assert
      const copyCommand = MockCopyObjectCommand.mock.calls[0][0];
      expect(copyCommand.CopySource).toContain('trademark/tm-asset/tm-doc/logo.png');
      expect(copyCommand.Key).toBe('license/license-asset/license-doc/licensed-logo.png');
    });

    it('should use destination KMS key based on destination asset type', async () => {
      // Test: Regular source to regular dest -> documents key
      mockSend.mockResolvedValueOnce({});
      await service.copyDocument(
        'patent', 'a1', 'd1', 'f1',
        'trademark', 'a2', 'd2', 'f2'
      );
      expect(MockCopyObjectCommand.mock.calls[0][0].SSEKMSKeyId)
        .toBe(testConfig.documentsKeyId);

      vi.clearAllMocks();

      // Test: Trade secret source to trade secret dest -> trade secrets key
      mockSend.mockResolvedValueOnce({});
      await service.copyDocument(
        'trade_secret', 'a1', 'd1', 'f1',
        'trade_secret', 'a2', 'd2', 'f2'
      );
      expect(MockCopyObjectCommand.mock.calls[0][0].SSEKMSKeyId)
        .toBe(testConfig.tradeSecretsKeyId);
    });
  });

  // ===========================================================================
  // DOCUMENT EXISTS TESTS
  // ===========================================================================

  describe('documentExists', () => {
    it('should return true when document exists', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({
        ContentLength: 1024,
        ContentType: 'application/pdf',
      });

      // Act
      const result = await service.documentExists(
        'patent',
        'asset-001',
        'doc-001',
        'existing.pdf'
      );

      // Assert
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const headCommand = MockHeadObjectCommand.mock.calls[0][0];
      expect(headCommand).toMatchObject({
        Bucket: testConfig.documentsBucket,
        Key: 'patent/asset-001/doc-001/existing.pdf',
      });
    });

    it('should return false when document does not exist', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      // Act
      const result = await service.documentExists(
        'trademark',
        'asset-002',
        'doc-002',
        'nonexistent.png'
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should check trade secrets bucket for trade secret documents', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.documentExists(
        'trade_secret',
        'secret-asset',
        'secret-doc',
        'secret.txt'
      );

      // Assert
      const headCommand = MockHeadObjectCommand.mock.calls[0][0];
      expect(headCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
    });

    it('should return false on any error', async () => {
      // Arrange - simulate access denied error
      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      // Act
      const result = await service.documentExists(
        'domain',
        'domain-asset',
        'domain-doc',
        'cert.pem'
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // KEY PATH CONSTRUCTION TESTS
  // ===========================================================================

  describe('key path construction', () => {
    it('should construct key path in format: assetType/assetId/documentId/fileName', async () => {
      const testCases = [
        {
          assetType: 'patent' as const,
          assetId: 'pat-123',
          documentId: 'doc-456',
          fileName: 'application.pdf',
          expected: 'patent/pat-123/doc-456/application.pdf',
        },
        {
          assetType: 'trademark' as const,
          assetId: 'tm-789',
          documentId: 'doc-abc',
          fileName: 'logo.svg',
          expected: 'trademark/tm-789/doc-abc/logo.svg',
        },
        {
          assetType: 'trade_secret' as const,
          assetId: 'ts-xyz',
          documentId: 'doc-secret',
          fileName: 'formula.encrypted',
          expected: 'trade_secret/ts-xyz/doc-secret/formula.encrypted',
        },
      ];

      for (const tc of testCases) {
        vi.clearAllMocks();
        mockSend.mockResolvedValueOnce({});

        const metadata = {
          documentId: tc.documentId,
          assetType: tc.assetType,
          assetId: tc.assetId,
          fileName: tc.fileName,
          mimeType: 'application/octet-stream',
          uploadedBy: 'test-user',
        };

        await service.uploadDocument(Buffer.from('test'), metadata);

        const putCommand = MockPutObjectCommand.mock.calls[0][0];
        expect(putCommand.Key).toBe(tc.expected);
      }
    });

    it('should handle special characters in file names', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      const metadata = {
        documentId: 'doc-001',
        assetType: 'patent' as const,
        assetId: 'asset-001',
        fileName: 'file with spaces (2024).pdf',
        mimeType: 'application/pdf',
        uploadedBy: 'test-user',
      };

      // Act
      await service.uploadDocument(Buffer.from('test'), metadata);

      // Assert
      const putCommand = MockPutObjectCommand.mock.calls[0][0];
      expect(putCommand.Key).toBe('patent/asset-001/doc-001/file with spaces (2024).pdf');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    describe('not found errors', () => {
      it('should propagate error when downloading non-existent document', async () => {
        // Arrange
        const notFoundError = new Error('The specified key does not exist.');
        notFoundError.name = 'NoSuchKey';
        mockSend.mockRejectedValueOnce(notFoundError);

        // Act & Assert
        await expect(
          service.downloadDocument('patent', 'asset-001', 'doc-001', 'missing.pdf')
        ).rejects.toThrow('The specified key does not exist.');
      });

      it('should propagate error when deleting non-existent document', async () => {
        // Arrange
        const notFoundError = new Error('NoSuchKey');
        mockSend.mockRejectedValueOnce(notFoundError);

        // Act & Assert
        await expect(
          service.deleteDocument('patent', 'asset-001', 'doc-001', 'missing.pdf')
        ).rejects.toThrow();
      });
    });

    describe('permission denied errors', () => {
      it('should propagate access denied error on upload', async () => {
        // Arrange
        const accessDeniedError = new Error('Access Denied');
        accessDeniedError.name = 'AccessDenied';
        mockSend.mockRejectedValueOnce(accessDeniedError);

        // Act & Assert
        await expect(
          service.uploadDocument(
            Buffer.from('content'),
            createTestMetadata('patent')
          )
        ).rejects.toThrow('Access Denied');
      });

      it('should propagate access denied error on download', async () => {
        // Arrange
        const accessDeniedError = new Error('Access Denied');
        accessDeniedError.name = 'AccessDenied';
        mockSend.mockRejectedValueOnce(accessDeniedError);

        // Act & Assert
        await expect(
          service.downloadDocument('trade_secret', 'asset', 'doc', 'file.txt')
        ).rejects.toThrow('Access Denied');
      });

      it('should propagate KMS key access error', async () => {
        // Arrange
        const kmsError = new Error('The ciphertext refers to a customer master key that does not exist');
        kmsError.name = 'KMSInvalidState';
        mockSend.mockRejectedValueOnce(kmsError);

        // Act & Assert
        await expect(
          service.uploadDocument(
            Buffer.from('content'),
            createTestMetadata('trade_secret')
          )
        ).rejects.toThrow();
      });
    });

    describe('network and service errors', () => {
      it('should propagate network timeout error', async () => {
        // Arrange
        const timeoutError = new Error('Connection timeout');
        timeoutError.name = 'TimeoutError';
        mockSend.mockRejectedValueOnce(timeoutError);

        // Act & Assert
        await expect(
          service.listDocuments('patent', 'asset-001')
        ).rejects.toThrow('Connection timeout');
      });

      it('should propagate S3 service error', async () => {
        // Arrange
        const serviceError = new Error('Internal Server Error');
        serviceError.name = 'InternalError';
        mockSend.mockRejectedValueOnce(serviceError);

        // Act & Assert
        await expect(
          service.copyDocument(
            'patent', 'src', 'doc', 'f1',
            'patent', 'dst', 'doc', 'f2'
          )
        ).rejects.toThrow('Internal Server Error');
      });
    });
  });

  // ===========================================================================
  // CONFIGURATION TESTS
  // ===========================================================================

  describe('service configuration', () => {
    it('should use provided configuration options', async () => {
      // Arrange
      mockSend.mockResolvedValueOnce({});

      // Act
      await service.uploadDocument(Buffer.from('test'), createTestMetadata('patent'));

      // Assert
      const putCommand = MockPutObjectCommand.mock.calls[0][0];
      expect(putCommand.Bucket).toBe(testConfig.documentsBucket);
      expect(putCommand.SSEKMSKeyId).toBe(testConfig.documentsKeyId);
    });

    it('should handle all supported asset types', async () => {
      const assetTypes: Array<DocumentMetadata['assetType']> = [
        'patent',
        'trademark',
        'trade_secret',
        'domain',
        'license',
        'general',
      ];

      for (const assetType of assetTypes) {
        vi.clearAllMocks();
        mockSend.mockResolvedValueOnce({});

        const metadata = createTestMetadata(assetType);
        await service.uploadDocument(Buffer.from('test'), metadata);

        const putCommand = MockPutObjectCommand.mock.calls[0][0];

        if (assetType === 'trade_secret') {
          expect(putCommand.Bucket).toBe(testConfig.tradeSecretsBucket);
        } else {
          expect(putCommand.Bucket).toBe(testConfig.documentsBucket);
        }

        expect(putCommand.Key).toContain(assetType);
      }
    });
  });
});
