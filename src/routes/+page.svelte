<script lang="ts">
	import { onMount } from 'svelte';
	import { MonacoEditor } from '$lib';

	let sevenmarkCode = $state(`# SevenMark 테스트

이것은 **강조**된 텍스트이고 *기울임* 텍스트입니다.

\`inline code\` 도 있습니다.

{{{#style color: red}}}
빨간 글씨
}}}

{{{#quote author: "Someone"}}}
인용문입니다.
}}}

// 이것은 주석입니다
/* 
여러줄 주석도 가능합니다
*/`);

	let parsedResult = $state('');
	let wasmLoaded = $state(false);
	let parseFunction: ((input: string) => string) | null = null;

	onMount(async () => {
		try {
			// web 타겟 WASM 로드 (init 함수 사용)
			const init = (await import('../sevenmark-wasm-web-v2.0.14/sevenmark.js')).default;
			const { parse_sevenmark_to_monaco } = await import(
				'../sevenmark-wasm-web-v2.0.14/sevenmark.js'
			);

			// WASM 초기화
			await init();

			parseFunction = parse_sevenmark_to_monaco;
			wasmLoaded = true;
			console.log('WASM module loaded successfully!');

			// 테스트 파싱
			parsedResult = parseFunction(sevenmarkCode);
		} catch (error) {
			console.error('Failed to load WASM module:', error);
		}
	});

	function testParse() {
		if (parseFunction) {
			try {
				parsedResult = parseFunction(sevenmarkCode);
			} catch (error) {
				console.error('Parse error:', error);
				parsedResult = 'Parse error: ' + error;
			}
		}
	}

	// 🧪 자동 파싱 비활성화 - 타이핑 렉 테스트용
	// $effect(() => {
	// 	if (wasmLoaded && parseFunction) {
	// 		testParse();
	// 	}
	// });
</script>

<div class="min-h-screen bg-black">
	<header class="border-b bg-black shadow-sm">
		<div class="max-w-full px-6 py-4">
			<h1 class="text-2xl font-bold text-gray-900">SevenMark Monaco Editor</h1>
			<p class="mt-1 text-gray-600">WASM 파서를 사용한 SevenMark 구문 강조 에디터</p>
			<div class="mt-3">
				<span
					class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {wasmLoaded
						? 'bg-green-100 text-green-800'
						: 'bg-red-100 text-red-800'}"
				>
					{wasmLoaded ? '✅ WASM Loaded' : '❌ WASM Not Loaded'}
				</span>
			</div>
		</div>
	</header>

	<div class="flex h-[calc(100vh-120px)]">
		<!-- 에디터 영역 -->
		<div class="w-full p-4">
			<div class="h-full overflow-hidden rounded-lg border bg-white shadow-sm">
				<div class="border-b bg-gray-50 px-4 py-3">
					<h2 class="text-lg font-semibold text-gray-900">SevenMark Editor</h2>
				</div>
				<div class="h-[calc(100%-57px)]">
					<MonacoEditor
						bind:value={sevenmarkCode}
						language="sevenmark"
						theme="vs-dark"
						height="100%"
					/>
				</div>
			</div>
		</div>
	</div>
</div>
