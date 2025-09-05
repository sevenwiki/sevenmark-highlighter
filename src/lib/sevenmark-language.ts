import type { languages } from 'monaco-editor';
import type * as monacoType from 'monaco-editor';

export interface Location {
	start_line: number;
	end_line: number;
	start_column: number;
	end_column: number;
}

export interface DecorationInfo {
	range: monacoType.Range;
	className: string;
	hoverMessage?: string;
}

export interface FoldingRangeInfo {
	start: number;
	end: number;
	kind?: monacoType.languages.FoldingRangeKind;
}

import { SevenMarkWorkerClient } from './sevenmark-worker-client.js';

export class SevenMarkDecorationProvider {
	private workerClient: SevenMarkWorkerClient;
	private lastTextContent: string = '';
	private cachedDecorations: DecorationInfo[] = [];

	constructor() {
		this.workerClient = new SevenMarkWorkerClient();
	}

	// 기존 동기 함수는 deprecated
	setParseFunction(parseFunction: (input: string) => string) {
		console.warn('setParseFunction is deprecated, using Web Worker instead');
	}

	// 완전 비동기 - 메인 스레드를 절대 블록하지 않음
	updateDecorationsAsync(
		model: monacoType.editor.ITextModel,
		monaco: typeof import('monaco-editor'),
		callback: (decorations: any[]) => void
	): void {
		const text = model.getValue();
		console.log(`🔧 Starting async parse for ${text.length} chars - no blocking`);
		
		// 워커에 요청만 보내고 즉시 반환
		this.workerClient.parse(text).then(parsed => {
			console.log(`⚡ Worker completed, processing in background`);
			
			try {
				const elements = JSON.parse(parsed);
				const decorations: DecorationInfo[] = [];
				this.processAny(elements, monaco, decorations);
				
				// Monaco 형식으로 변환
				const monacoDecorations = decorations.map((dec) => ({
					range: dec.range,
					options: {
						inlineClassName: dec.className,
						hoverMessage: dec.hoverMessage ? { value: dec.hoverMessage } : undefined
					}
				}));
				
				console.log(`📊 Background processing completed: ${decorations.length} decorations`);
				
				// UI 업데이트 콜백 실행
				callback(monacoDecorations);
			} catch (error) {
				console.error('❌ Background decoration processing error:', error);
				callback([]);
			}
		}).catch(error => {
			console.error('❌ Worker parse error:', error);
			callback([]);
		});
		
		// 메인 스레드는 즉시 반환
		console.log('🚀 Parse request sent to worker, main thread continuing');
	}

	destroy() {
		this.workerClient.destroy();
	}


	private locationToRange(
		location: Location,
		monaco: typeof import('monaco-editor')
	): monacoType.Range {
		return new monaco.Range(
			location.start_line,
			location.start_column,
			location.end_line,
			location.end_column
		);
	}

	private getElementType(element: any): string | null {
		if (!element || typeof element !== 'object') return null;
		const keys = Object.keys(element);
		return keys.length === 1 ? keys[0] : null;
	}

	private getClassName(elementType: string, elementData: any): string {
		switch (elementType) {
			case 'Header':
				return `sevenmark-header sevenmark-header-${elementData.level || 1}`;
			case 'Bold':
				return 'sevenmark-bold';
			case 'Italic':
				return 'sevenmark-italic';
			case 'BoldItalic':
				return 'sevenmark-bold sevenmark-italic';
			case 'Strikethrough':
				return 'sevenmark-strikethrough';
			case 'Underline':
				return 'sevenmark-underline';
			case 'Superscript':
				return 'sevenmark-superscript';
			case 'Subscript':
				return 'sevenmark-subscript';
			case 'CodeElement':
				return 'sevenmark-code';
			case 'Comment':
				return 'sevenmark-comment';
			case 'Error':
				return 'sevenmark-error';
			case 'LiteralElement':
				return 'sevenmark-literal';
			case 'FoldElement':
				return 'sevenmark-fold';
			case 'TableElement':
				return 'sevenmark-table';
			case 'BlockQuoteElement':
				return 'sevenmark-quote';
			case 'StyledElement':
				return 'sevenmark-styled';
			case 'Include':
				return 'sevenmark-include';
			default:
				return `sevenmark-${elementType.toLowerCase()}`;
		}
	}

	private shouldUseMarkerHighlight(elementType: string): boolean {
		return [
			'FoldElement',
			'TableElement',
			'ListElement',
			'BlockQuoteElement',
			'StyledElement',
			'Include'
		].includes(elementType);
	}

	private getMarkers(elementType: string): { start: string; end: string } {
		switch (elementType) {
			case 'FoldElement':
				return { start: '{{{#fold', end: '}}}' };
			case 'TableElement':
				return { start: '{{{#table', end: '}}}' };
			case 'ListElement':
				return { start: '{{{#list', end: '}}}' };
			case 'BlockQuoteElement':
				return { start: '{{{#quote', end: '}}}' };
			case 'StyledElement':
				return { start: '{{{#style', end: '}}}' };
			case 'Include':
				return { start: '{{{#include', end: '}}}' };
			default:
				return { start: '{{{', end: '}}}' };
		}
	}

	private addMarkerHighlight(
		location: Location,
		startMarker: string,
		endMarker: string,
		className: string,
		hoverMessage: string,
		monaco: typeof import('monaco-editor'),
		decorations: DecorationInfo[]
	) {
		// 시작 마커 하이라이팅
		const startRange = new monaco.Range(
			location.start_line,
			location.start_column,
			location.start_line,
			location.start_column + startMarker.length
		);

		decorations.push({
			range: startRange,
			className: className,
			hoverMessage: hoverMessage + ' start'
		});

		// 종료 마커 하이라이팅
		const endRange = new monaco.Range(
			location.end_line,
			location.end_column - endMarker.length,
			location.end_line,
			location.end_column
		);

		decorations.push({
			range: endRange,
			className: className,
			hoverMessage: hoverMessage + ' end'
		});
	}

	private processAny(
		value: any,
		monaco: typeof import('monaco-editor'),
		decorations: DecorationInfo[]
	) {
		if (Array.isArray(value)) {
			// 배열인 경우 각 요소를 재귀 처리
			for (const item of value) {
				this.processAny(item, monaco, decorations);
			}
		} else if (value && typeof value === 'object') {
			// 객체인 경우
			const elementType = this.getElementType(value);

			if (elementType) {
				// SevenMark 요소인 경우
				const elementData = value[elementType];

				// location이 있고 하이라이팅이 필요한 요소인 경우
				if (elementData && elementData.location && !['Text', 'NewLine', 'HLine'].includes(elementType)) {
					const className = this.getClassName(elementType, elementData);

					if (this.shouldUseMarkerHighlight(elementType)) {
						// 마커만 하이라이팅
						const markers = this.getMarkers(elementType);
						this.addMarkerHighlight(
							elementData.location,
							markers.start,
							markers.end,
							className,
							elementType,
							monaco,
							decorations
						);
					} else {
						// 전체 범위 하이라이팅
						decorations.push({
							range: this.locationToRange(elementData.location, monaco),
							className: className,
							hoverMessage: elementType
						});
					}
				}

				// elementData의 모든 속성을 재귀 처리
				this.processAny(elementData, monaco, decorations);
			} else {
				// 일반 객체인 경우 모든 속성을 재귀 처리
				for (const [key, val] of Object.entries(value)) {
					if (key === 'location') {
						// location 객체 자체는 건너뜀
						continue;
					}

					// parameters의 각 parameter는 별도 처리
					if (key === 'parameters' && val && typeof val === 'object') {
						Object.entries(val).forEach(([paramKey, param]: [string, any]) => {
							if (param && param.location) {
								decorations.push({
									range: this.locationToRange(param.location, monaco),
									className: `sevenmark-parameter sevenmark-parameter-${paramKey.toLowerCase()}`,
									hoverMessage: `Parameter: ${param.key || paramKey}`
								});
							}
							// parameter의 value도 재귀 처리
							this.processAny(param, monaco, decorations);
						});
					} else {
						// 다른 속성들은 일반 재귀 처리
						this.processAny(val, monaco, decorations);
					}
				}
			}
		}
	}


}

export const sevenMarkLanguageConfiguration: languages.LanguageConfiguration = {
	comments: {
		lineComment: '//',
		blockComment: ['/*', '*/']
	},
	brackets: [
		['{{{', '}}}'],
		['[[', ']]'],
		['{', '}'],
		['[', ']'],
		['(', ')']
	],
	autoClosingPairs: [
		{ open: '{{{', close: '}}}' },
		{ open: '[[', close: ']]' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" }
	],
	surroundingPairs: [
		{ open: '{{{', close: '}}}' },
		{ open: '[[', close: ']]' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" }
	]
	// folding은 WASM AST 기반 FoldingRangeProvider를 통해 제공
};
