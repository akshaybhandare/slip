type Task<T> = () => Promise<T>;

interface QueueItem<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export class JobQueue {
  private concurrency: number;
  private queue: QueueItem<any>[] = [];
  private activeCount: number = 0;

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  public add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    item.task()
      .then((result) => {
        item.resolve(result);
      })
      .catch((err) => {
        item.reject(err);
      })
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }

  public get pending(): number {
    return this.queue.length;
  }

  public get active(): number {
    return this.activeCount;
  }
}

export const scrapeQueue = new JobQueue(2);
