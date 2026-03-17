import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { DailySnapshot, SnapshotMeta } from './types';

interface StorageFile {
  snapshots: DailySnapshot[];
  meta?: SnapshotMeta;
}

export class SnapshotStorage {
  constructor(private readonly filePath: string) {}

  async load(): Promise<StorageFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StorageFile;
      return {
        snapshots: parsed.snapshots ?? [],
        meta: parsed.meta ?? {},
      };
    } catch (error) {
      return { snapshots: [], meta: {} };
    }
  }

  async saveSnapshot(snapshot: DailySnapshot): Promise<void> {
    const data = await this.load();
    const snapshots = data.snapshots.filter(item => item.date !== snapshot.date);
    snapshots.push(snapshot);
    snapshots.sort((a, b) => a.date.localeCompare(b.date));

    await this.write({
      snapshots: snapshots.slice(-30),
      meta: data.meta,
    });
  }

  async updateMeta(meta: SnapshotMeta): Promise<void> {
    const data = await this.load();
    await this.write({
      snapshots: data.snapshots,
      meta: { ...data.meta, ...meta },
    });
  }

  async getLatestSnapshot(excludingDate?: string): Promise<DailySnapshot | undefined> {
    const data = await this.load();
    const snapshots = excludingDate
      ? data.snapshots.filter(item => item.date !== excludingDate)
      : data.snapshots;

    return snapshots.at(-1);
  }

  async getMeta(): Promise<SnapshotMeta> {
    const data = await this.load();
    return data.meta ?? {};
  }

  private async write(data: StorageFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
