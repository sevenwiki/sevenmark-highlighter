let parseFunction: ((input: string) => string) | null = null;
let currentRequestId: number | null = null;

self.onmessage = function (e) {
	const { type, data } = e.data;

	switch (type) {
		case 'init':
			// WASM 초기화
			initWasm(data.wasmUrl);
			break;

		case 'parse':
			currentRequestId = data.requestId;

			// 텍스트 파싱
			if (parseFunction) {
				try {
					const result = parseFunction(data.text);

					if (currentRequestId === data.requestId) {
						self.postMessage({
							type: 'parsed',
							requestId: data.requestId,
							result: result
						});

						currentRequestId = null;
					}
				} catch (error) {
					if (currentRequestId === data.requestId) {
						self.postMessage({
							type: 'error',
							requestId: data.requestId,
							error: error instanceof Error ? error.message : String(error)
						});
						currentRequestId = null;
					}
				}
			} else {
				if (currentRequestId === data.requestId) {
					self.postMessage({
						type: 'error',
						requestId: data.requestId,
						error: 'WASM not initialized'
					});
					currentRequestId = null;
				}
			}
			break;
	}
};

async function initWasm(wasmUrl: string) {
	try {
		// SevenMark WASM 모듈 로드
		const wasmModule = await import(/* @vite-ignore */ wasmUrl);
		await wasmModule.default(); // WASM 초기화

		// parse 함수 설정
		parseFunction = wasmModule.parse_sevenmark_to_monaco;

		self.postMessage({
			type: 'initialized'
		});
	} catch (error) {
		self.postMessage({
			type: 'error',
			error: `WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`
		});
	}
}
