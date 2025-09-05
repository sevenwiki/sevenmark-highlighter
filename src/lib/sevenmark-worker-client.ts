// Web Worker 클라이언트 클래스

export class SevenMarkWorkerClient {
	private worker: Worker | null = null;
	private initialized: boolean = false;
	private requestId: number = 0;
	private pendingRequests: Map<number, { resolve: (result: string) => void; reject: (error: Error) => void }> = new Map();
	private currentRequestId: number | null = null;

	constructor() {
		this.initWorker();
	}

	private async initWorker() {
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
						this.initialized = true;
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
					wasmUrl: '../sevenmark-wasm-web-v2.0.12/sevenmark.js'
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
		
		if (!this.initialized) {
			// Worker 초기화를 기다림 (최대 3초)
			await new Promise((resolve, reject) => {
				const checkInterval = setInterval(() => {
					if (this.initialized) {
						clearInterval(checkInterval);
						resolve(null);
					}
				}, 100);
				
				setTimeout(() => {
					clearInterval(checkInterval);
					reject(new Error('Worker initialization timeout'));
				}, 3000);
			});
		}

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
		this.initialized = false;
	}
}