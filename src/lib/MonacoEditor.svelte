<script lang="ts">
	import { onMount } from 'svelte';
	import type * as monacoType from 'monaco-editor';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

	let {
		value = $bindable(''),
		language = 'sevenmark',
		theme = 'vs-dark',
		height = '400px'
	} = $props();

	let monaco: typeof import('monaco-editor');
	let container: HTMLDivElement;
	let editor: monacoType.editor.IStandaloneCodeEditor;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		const initMonaco = async () => {
			// container가 준비될 때까지 기다리기
			if (!container) {
				console.error('Container not ready');
				return;
			}

			// Monaco Editor 동적 로드
			monaco = await import('monaco-editor');

			// Worker 설정
			self.MonacoEnvironment = {
				getWorker: function (_: any, label: string) {
					return new editorWorker();
				}
			};

			// SevenMark 언어 모듈 로드 (decoration 다시 활성화)
			const { SevenMarkDecorationProvider, sevenMarkLanguageConfiguration } = await import(
				'./sevenmark-language.js'
			);

			// SevenMark 언어 등록
			monaco.languages.register({ id: 'sevenmark' });
			monaco.languages.setLanguageConfiguration('sevenmark', sevenMarkLanguageConfiguration);

			// 데코레이션 프로바이더 생성
			const decorationProvider = new SevenMarkDecorationProvider();

			// web 타겟 WASM 로드

			// 에디터 생성 - sevenmark 언어 사용
			editor = monaco.editor.create(container, {
				value,
				language: 'sevenmark',
				theme: 'vs-dark',
				automaticLayout: true,
				minimap: { enabled: false },
				wordWrap: 'on',
				lineNumbers: 'on',
				folding: true,
				fontSize: 14
			});

			let currentDecorations: string[] = [];

			// decoration 업데이트 함수 (즉시 실행, 이전 요청 취소)
			const updateDecorations = () => {
				decorationProvider.updateDecorationsAsync(
					editor.getModel()!,
					monaco,
					(monacoDecorations) => {
						// 워커 완료 후 decoration 적용
						currentDecorations = editor.deltaDecorations(currentDecorations, monacoDecorations);
						console.log(`✅ Applied ${monacoDecorations.length} decorations`);
					}
				);
			};

			// 값 변경 이벤트 리스너 (즉시 실행, 워커에서 이전 요청 취소)
			editor.onDidChangeModelContent(() => {
				value = editor.getValue();

				// 즉시 decoration 업데이트 (워커가 이전 요청을 자동 취소)
				updateDecorations();
			});

			// 초기 decoration 적용
			updateDecorations();

			cleanup = () => {
				decorationProvider.destroy();
				editor?.dispose();
			};
		};

		// DOM이 준비된 후 Monaco 초기화
		setTimeout(() => {
			initMonaco().catch(console.error);
		}, 0);

		return () => {
			cleanup?.();
		};
	});

	// value prop이 외부에서 변경될 때 에디터 업데이트
	$effect(() => {
		if (editor && value !== editor.getValue()) {
			editor.setValue(value);
		}
	});

	// theme prop이 변경될 때 테마 업데이트
	$effect(() => {
		if (editor && monaco) {
			monaco.editor.setTheme(theme === 'vs-dark' ? 'sevenmark-dark' : theme);
		}
	});
</script>

<div bind:this={container} style="height: {height}; width: 100%;"></div>

<style>
	div {
		border: 1px solid #3c3c3c;
		border-radius: 4px;
	}
</style>
