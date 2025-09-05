// Web Worker for SevenMark WASM parsing

let parseFunction: ((input: string) => string) | null = null;
let currentRequestId: number | null = null;

// WASM 초기화 메시지 처리
self.onmessage = function(e) {
	const { type, data } = e.data;

	switch (type) {
		case 'init':
			// WASM 초기화
			initWasm(data.wasmUrl);
			break;
			
		case 'parse':
			// 새로운 요청으로 교체
			currentRequestId = data.requestId;
			
			// 텍스트 파싱
			if (parseFunction) {
				try {
					const result = parseFunction(data.text);
					
					// 파싱 완료 후에도 현재 요청인지 확인
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
		const wasmModule = await import(wasmUrl);
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