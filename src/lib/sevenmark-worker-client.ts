// Web Worker 클라이언트 클래스

export class SevenMarkWorkerClient {
	private worker: Worker | null = null;
	private requestId: number = 0;
	private pendingRequests: Map<
		number,
		{ resolve: (result: string) => void; reject: (error: Error) => void }
	> = new Map();
	private currentRequestId: number | null = null;
	private initPromise: Promise<void>;
	private initResolve: (() => void) | null = null;

	constructor() {
		this.initPromise = new Promise((resolve) => {
			this.initResolve = resolve;
		});
		this.initWorker();
	}

	private initWorker() {
		try {
			// Worker 생성
			this.worker = new Worker(new URL('./sevenmark-worker.ts', import.meta.url), {
				type: 'module'
			});

			// Worker 메시지 처리
			this.worker.onmessage = (e) => {
				const { type, requestId, result, error } = e.data;

				switch (type) {
					case 'initialized':
						if (this.initResolve) {
							this.initResolve();
							this.initResolve = null;
						}
						break;

					case 'parsed':
						const request = this.pendingRequests.get(requestId);
						if (request) {
							request.resolve(result);
							this.pendingRequests.delete(requestId);
							if (this.currentRequestId === requestId) {
								this.currentRequestId = null;
							}
						}
						break;

					case 'error':
						if (requestId !== undefined) {
							const request = this.pendingRequests.get(requestId);
							if (request) {
								request.reject(new Error(error));
								this.pendingRequests.delete(requestId);
								if (this.currentRequestId === requestId) {
									this.currentRequestId = null;
								}
							}
						}
						break;
				}
			};

			this.worker.onerror = (error) => {
				console.error('Worker error:', error);
			};

			// WASM 초기화 요청
			this.worker.postMessage({
				type: 'init',
				data: {
					wasmUrl: '../sevenmark-wasm-web-v2.6.8/sevenmark_transform.js'
				}
			});
		} catch (error) {
			console.error('Failed to create worker:', error);
		}
	}

	async parse(text: string): Promise<string> {
		if (!this.worker) {
			throw new Error('Worker not created');
		}

		// Worker 초기화 완료까지 대기
		await this.initPromise;

		// 이전 요청 취소
		if (this.currentRequestId !== null && this.pendingRequests.has(this.currentRequestId)) {
			const oldRequest = this.pendingRequests.get(this.currentRequestId);
			this.pendingRequests.delete(this.currentRequestId);
			oldRequest?.reject(new Error(`Request ${this.currentRequestId} cancelled by newer request`));
		}

		return new Promise((resolve, reject) => {
			const newRequestId = ++this.requestId;
			this.currentRequestId = newRequestId;
			this.pendingRequests.set(newRequestId, { resolve, reject });

			this.worker!.postMessage({
				type: 'parse',
				data: {
					text: text,
					requestId: newRequestId
				}
			});
		});
	}

	destroy() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.pendingRequests.clear();
	}
}
