/**
 * S3 Document Storage Service for Intellectual Property
 *
 * Manages document storage for IP assets with:
 * - Tiered storage for patents, trademarks, domains
 * - High-security trade secret storage with encryption
 * - Lifecycle policies and versioning
 *
 * @module infrastructure/aws
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  type ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsConfig } from './config.js';

const client = new S3Client({ region: awsConfig.region });

/**
 * Document metadata structure.
 */
export interface DocumentMetadata {
  documentId: string;
  assetType: 'patent' | 'trademark' | 'trade_secret' | 'domain' | 'license' | 'general';
  assetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted' | undefined;
  tags?: Record<string, string> | undefined;
  checksum?: string | undefined;
}

/**
 * Upload options.
 */
export interface UploadOptions {
  classification?: DocumentMetadata['classification'] | undefined;
  tags?: Record<string, string> | undefined;
  contentDisposition?: string | undefined;
  expiresAt?: Date | undefined;
}

/**
 * Download result.
 */
export interface DownloadResult {
  body: ReadableStream | Blob | undefined;
  metadata: DocumentMetadata;
  contentType: string;
  contentLength: number;
}

/**
 * S3 Document Service
 *
 * Manages IP document storage with proper encryption and lifecycle policies.
 */
export class S3DocumentService {
  private readonly documentsBucket: string;
  private readonly tradeSecretsBucket: string;
  private readonly documentsKeyId: string;
  private readonly tradeSecretsKeyId: string;

  constructor(options?: {
    documentsBucket?: string | undefined;
    tradeSecretsBucket?: string | undefined;
    documentsKeyId?: string | undefined;
    tradeSecretsKeyId?: string | undefined;
  }) {
    this.documentsBucket = options?.documentsBucket ?? awsConfig.s3.documentsBucket;
    this.tradeSecretsBucket = options?.tradeSecretsBucket ?? awsConfig.s3.tradeSecretsBucket;
    this.documentsKeyId = options?.documentsKeyId ?? awsConfig.kms.documentsKeyId;
    this.tradeSecretsKeyId = options?.tradeSecretsKeyId ?? awsConfig.kms.tradeSecretsKeyId;
  }

  /**
   * Upload a document.
   */
  async uploadDocument(
    content: Buffer | Uint8Array | ReadableStream,
    metadata: Omit<DocumentMetadata, 'uploadedAt' | 'sizeBytes'>,
    options?: UploadOptions
  ): Promise<DocumentMetadata> {
    const isTradeSecret = metadata.assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const kmsKeyId = isTradeSecret ? this.tradeSecretsKeyId : this.documentsKeyId;

    const key = this.buildKey(metadata.assetType, metadata.assetId, metadata.documentId, metadata.fileName);
    const contentLength = content instanceof Buffer ? content.length : 0;

    const s3Metadata: Record<string, string> = {
      'x-amz-meta-document-id': metadata.documentId,
      'x-amz-meta-asset-type': metadata.assetType,
      'x-amz-meta-asset-id': metadata.assetId,
      'x-amz-meta-uploaded-by': metadata.uploadedBy,
      'x-amz-meta-classification': options?.classification ?? 'internal',
    };

    if (metadata.checksum) {
      s3Metadata['x-amz-meta-checksum'] = metadata.checksum;
    }

    // Add custom tags to metadata
    if (options?.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        s3Metadata[`x-amz-meta-tag-${key}`] = value;
      });
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: metadata.mimeType,
      ContentDisposition: options?.contentDisposition ?? `attachment; filename="${metadata.fileName}"`,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: kmsKeyId,
      Metadata: s3Metadata,
      // Restrict access for trade secrets
      ...(isTradeSecret && { ACL: 'private' as ObjectCannedACL }),
    });

    await client.send(command);

    return {
      ...metadata,
      sizeBytes: contentLength,
      uploadedAt: new Date(),
      classification: options?.classification ?? 'internal',
      tags: options?.tags,
    };
  }

  /**
   * Download a document.
   */
  async downloadDocument(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string
  ): Promise<DownloadResult> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const key = this.buildKey(assetType, assetId, documentId, fileName);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    return {
      body: response.Body?.transformToWebStream(),
      metadata: {
        documentId: response.Metadata?.['document-id'] ?? documentId,
        assetType,
        assetId,
        fileName,
        mimeType: response.ContentType ?? 'application/octet-stream',
        sizeBytes: response.ContentLength ?? 0,
        uploadedBy: response.Metadata?.['uploaded-by'] ?? 'unknown',
        uploadedAt: response.LastModified ?? new Date(),
        classification: response.Metadata?.['classification'] as DocumentMetadata['classification'],
        checksum: response.Metadata?.['checksum'],
      },
      contentType: response.ContentType ?? 'application/octet-stream',
      contentLength: response.ContentLength ?? 0,
    };
  }

  /**
   * Get a presigned URL for download (temporary access).
   */
  async getPresignedDownloadUrl(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const key = this.buildKey(assetType, assetId, documentId, fileName);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Get a presigned URL for upload.
   */
  async getPresignedUploadUrl(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string,
    mimeType: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const kmsKeyId = isTradeSecret ? this.tradeSecretsKeyId : this.documentsKeyId;
    const key = this.buildKey(assetType, assetId, documentId, fileName);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: kmsKeyId,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Delete a document.
   */
  async deleteDocument(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string
  ): Promise<void> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const key = this.buildKey(assetType, assetId, documentId, fileName);

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  }

  /**
   * List documents for an asset.
   */
  async listDocuments(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    maxResults = 100
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const prefix = `${assetType}/${assetId}/`;

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxResults,
    });

    const response = await client.send(command);

    return (response.Contents ?? []).map(item => ({
      key: item.Key ?? '',
      size: item.Size ?? 0,
      lastModified: item.LastModified ?? new Date(),
    }));
  }

  /**
   * Copy document (for versioning or moving between assets).
   */
  async copyDocument(
    sourceAssetType: DocumentMetadata['assetType'],
    sourceAssetId: string,
    sourceDocumentId: string,
    sourceFileName: string,
    destAssetType: DocumentMetadata['assetType'],
    destAssetId: string,
    destDocumentId: string,
    destFileName: string
  ): Promise<void> {
    const isSourceTradeSecret = sourceAssetType === 'trade_secret';
    const isDestTradeSecret = destAssetType === 'trade_secret';
    const sourceBucket = isSourceTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const destBucket = isDestTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const sourceKey = this.buildKey(sourceAssetType, sourceAssetId, sourceDocumentId, sourceFileName);
    const destKey = this.buildKey(destAssetType, destAssetId, destDocumentId, destFileName);
    const destKmsKeyId = isDestTradeSecret ? this.tradeSecretsKeyId : this.documentsKeyId;

    const command = new CopyObjectCommand({
      CopySource: `${sourceBucket}/${sourceKey}`,
      Bucket: destBucket,
      Key: destKey,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: destKmsKeyId,
    });

    await client.send(command);
  }

  /**
   * Check if document exists.
   */
  async documentExists(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string
  ): Promise<boolean> {
    const isTradeSecret = assetType === 'trade_secret';
    const bucket = isTradeSecret ? this.tradeSecretsBucket : this.documentsBucket;
    const key = this.buildKey(assetType, assetId, documentId, fileName);

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build S3 key from components.
   */
  private buildKey(
    assetType: DocumentMetadata['assetType'],
    assetId: string,
    documentId: string,
    fileName: string
  ): string {
    // Structure: {assetType}/{assetId}/{documentId}/{fileName}
    return `${assetType}/${assetId}/${documentId}/${fileName}`;
  }
}

// Singleton instance
export const s3DocumentService = new S3DocumentService();
