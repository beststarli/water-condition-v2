import {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { RUSTFS } from '@/config/rustfs'
import type { Readable } from 'stream'

const client = new S3Client({
    endpoint: RUSTFS.endpoint,
    region: RUSTFS.region,
    credentials: {
        accessKeyId: RUSTFS.accessKey,
        secretAccessKey: RUSTFS.secretKey,
    },
    forcePathStyle: true,
})

let bucketEnsured = false
async function ensureBucket() {
    if (bucketEnsured) return
    try {
        await client.send(new HeadBucketCommand({ Bucket: RUSTFS.bucket }))
    } catch {
        await client.send(new CreateBucketCommand({ Bucket: RUSTFS.bucket }))
    }
    bucketEnsured = true
}

export const rustfs = {
    async upload(key: string, body: Readable | Buffer | Uint8Array | string) {
        await ensureBucket()
        await new Upload({
            client,
            params: {
                Bucket: RUSTFS.bucket,
                Key: key,
                Body: body,
            },
        }).done()
        return {
            key,
            url: `${RUSTFS.publicUrlBase}/${key}`,
        }
    },

    async download(key: string) {
        try {
            const result = await client.send(
                new GetObjectCommand({ Bucket: RUSTFS.bucket, Key: key }),
            )
            return result.Body as Readable | undefined
        } catch {
            return undefined
        }
    },

    async delete(key: string) {
        await client.send(
            new DeleteObjectCommand({ Bucket: RUSTFS.bucket, Key: key }),
        )
    },

    getUrl(key: string) {
        return `${RUSTFS.publicUrlBase}/${key}`
    },

    async listObjects(prefix: string) {
        try {
            const result = await client.send(
                new ListObjectsV2Command({
                    Bucket: RUSTFS.bucket,
                    Prefix: prefix,
                }),
            )
            return (result.Contents ?? []).map((obj) => ({
                key: obj.Key!,
                size: obj.Size ?? 0,
                lastModified: obj.LastModified,
            }))
        } catch {
            return []
        }
    },
}
