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

// Expression 타입 목록 (processAny에서 건너뛰기 위한 상수)
const EXPRESSION_TYPES = new Set([
	'Or', 'And', 'Not', 'Comparison', 'Group', 'FunctionCall',
	'StringLiteral', 'NumberLiteral', 'BoolLiteral', 'Null'
]);

export class SevenMarkDecorationProvider {
	private workerClient: SevenMarkWorkerClient;
	private lastTextContent: string = '';
	private cachedDecorations: DecorationInfo[] = [];

	constructor() {
		this.workerClient = new SevenMarkWorkerClient();
	}

	// 완전 비동기 - 메인 스레드를 절대 블록하지 않음
	updateDecorationsAsync(
		model: monacoType.editor.ITextModel,
		monaco: typeof import('monaco-editor'),
		callback: (decorations: any[]) => void
	): void {
		const text = model.getValue();

		// 텍스트가 변경되지 않았으면 캐시된 결과 반환
		if (text === this.lastTextContent && this.cachedDecorations.length > 0) {
			const monacoDecorations = this.cachedDecorations.map((dec) => ({
				range: dec.range,
				options: {
					inlineClassName: dec.className,
					hoverMessage: dec.hoverMessage ? { value: dec.hoverMessage } : undefined
				}
			}));
			callback(monacoDecorations);
			return;
		}

		// 워커에 요청만 보내고 즉시 반환
		this.workerClient
			.parse(text)
			.then((parsed) => {
				try {
					const elements = JSON.parse(parsed);
					const decorations: DecorationInfo[] = [];
					this.processAny(elements, monaco, decorations);

					// 캐시 업데이트
					this.lastTextContent = text;
					this.cachedDecorations = decorations;

					// Monaco 형식으로 변환
					const monacoDecorations = decorations.map((dec) => ({
						range: dec.range,
						options: {
							inlineClassName: dec.className,
							hoverMessage: dec.hoverMessage ? { value: dec.hoverMessage } : undefined
						}
					}));

					// UI 업데이트 콜백 실행
					callback(monacoDecorations);
				} catch (error) {
					callback([]);
				}
			})
			.catch(() => {
				callback([]);
			});
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
			// New elements from Rust AST
			case 'Text':
				return 'sevenmark-text';
			case 'Escape':
				return 'sevenmark-escape';
			case 'RubyElement':
				return 'sevenmark-ruby';
			case 'FootnoteElement':
				return 'sevenmark-footnoteelement';
			case 'TeXElement':
				return 'sevenmark-texelement';
			case 'MediaElement':
				return 'sevenmark-mediaelement';
			case 'ListElement':
				return 'sevenmark-listelement';
			case 'IncludeElement':
				return 'sevenmark-includeelement';
			case 'CategoryElement':
				return 'sevenmark-categoryelement';
			case 'RedirectElement':
				return 'sevenmark-redirectelement';
			// Macro elements
			case 'Null':
				return 'sevenmark-null';
			case 'FootNote':
				return 'sevenmark-footnote';
			case 'TimeNow':
				return 'sevenmark-timenow';
			case 'NewLine':
				return 'sevenmark-newline';
			case 'Age':
				return 'sevenmark-age';
			case 'Variable':
				return 'sevenmark-variable';
			case 'HLine':
				return 'sevenmark-hline';
			// 조건문 요소
			case 'IfElement':
				return 'sevenmark-ifelement';
			case 'DefineElement':
				return 'sevenmark-defineelement';
			// 조건부 요소 (테이블/리스트 내부)
			case 'Conditional':
				return 'sevenmark-conditional';
			// Expression 요소들
			case 'Or':
				return 'sevenmark-expr-or';
			case 'And':
				return 'sevenmark-expr-and';
			case 'Not':
				return 'sevenmark-expr-not';
			case 'Comparison':
				return 'sevenmark-expr-comparison';
			case 'FunctionCall':
				return 'sevenmark-expr-function';
			case 'StringLiteral':
				return 'sevenmark-expr-string';
			case 'NumberLiteral':
				return 'sevenmark-expr-number';
			case 'BoolLiteral':
				return 'sevenmark-expr-bool';
			case 'Group':
				return 'sevenmark-expr-group';
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
			'Include',
			'IncludeElement',
			'CategoryElement',
			'RedirectElement',
			'IfElement',
			'DefineElement'
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
			case 'IncludeElement':
				return { start: '{{{#include', end: '}}}' };
			case 'CategoryElement':
				return { start: '[[Category:', end: ']]' };
			case 'RedirectElement':
				return { start: '#REDIRECT', end: '' };
			case 'IfElement':
				return { start: '{{{#if', end: '}}}' };
			case 'DefineElement':
				return { start: '{{{#define', end: '}}}' };
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

	private processExpression(
		expr: any,
		monaco: typeof import('monaco-editor'),
		decorations: DecorationInfo[]
	) {
		if (!expr || typeof expr !== 'object') return;

		const exprType = this.getElementType(expr);
		if (!exprType) return;

		const exprData = expr[exprType];

		// 재귀 처리 및 연산자/리프 노드만 하이라이팅
		switch (exprType) {
			case 'Or':
			case 'And':
				// 논리 연산자(||, &&)만 하이라이팅
				if (exprData?.operator?.location) {
					decorations.push({
						range: this.locationToRange(exprData.operator.location, monaco),
						className: 'sevenmark-expr-logical',
						hoverMessage: `Logical: ${exprData.operator.kind}`
					});
				}
				// left, right 재귀
				if (exprData?.left) this.processExpression(exprData.left, monaco, decorations);
				if (exprData?.right) this.processExpression(exprData.right, monaco, decorations);
				break;
			case 'Not':
				// NOT 연산자(!)만 하이라이팅
				if (exprData?.operator?.location) {
					decorations.push({
						range: this.locationToRange(exprData.operator.location, monaco),
						className: 'sevenmark-expr-not',
						hoverMessage: `Logical: ${exprData.operator.kind}`
					});
				}
				// inner 재귀
				if (exprData?.inner) this.processExpression(exprData.inner, monaco, decorations);
				break;
			case 'Comparison':
				// 비교 연산자(==, !=, >, <, >=, <=)만 하이라이팅
				if (exprData?.operator?.location) {
					decorations.push({
						range: this.locationToRange(exprData.operator.location, monaco),
						className: 'sevenmark-expr-operator',
						hoverMessage: `Operator: ${exprData.operator.kind}`
					});
				}
				// left, right 재귀
				if (exprData?.left) this.processExpression(exprData.left, monaco, decorations);
				if (exprData?.right) this.processExpression(exprData.right, monaco, decorations);
				break;
			case 'Group':
				// 괄호 하이라이팅 (시작과 끝)
				if (exprData?.location) {
					const loc = exprData.location;
					// 여는 괄호 (
					decorations.push({
						range: new monaco.Range(loc.start_line, loc.start_column, loc.start_line, loc.start_column + 1),
						className: 'sevenmark-expr-group',
						hoverMessage: 'Group ('
					});
					// 닫는 괄호 )
					decorations.push({
						range: new monaco.Range(loc.end_line, loc.end_column - 1, loc.end_line, loc.end_column),
						className: 'sevenmark-expr-group',
						hoverMessage: 'Group )'
					});
				}
				// inner 재귀
				if (exprData?.inner) this.processExpression(exprData.inner, monaco, decorations);
				break;
			case 'FunctionCall':
				// 함수 전체 하이라이팅
				if (exprData?.location) {
					decorations.push({
						range: this.locationToRange(exprData.location, monaco),
						className: 'sevenmark-expr-function',
						hoverMessage: `Function: ${exprData.name}`
					});
				}
				// arguments 배열 재귀
				if (exprData?.arguments && Array.isArray(exprData.arguments)) {
					for (const arg of exprData.arguments) {
						this.processExpression(arg, monaco, decorations);
					}
				}
				break;
			case 'Element':
				// SevenMarkElement 재귀 (processAny로 처리)
				this.processAny(exprData, monaco, decorations);
				break;
			case 'StringLiteral':
				// 문자열 리터럴 하이라이팅
				if (exprData?.location) {
					decorations.push({
						range: this.locationToRange(exprData.location, monaco),
						className: 'sevenmark-expr-string',
						hoverMessage: `String: "${exprData.value}"`
					});
				}
				break;
			case 'NumberLiteral':
				// 숫자 리터럴 하이라이팅
				if (exprData?.location) {
					decorations.push({
						range: this.locationToRange(exprData.location, monaco),
						className: 'sevenmark-expr-number',
						hoverMessage: `Number: ${exprData.value}`
					});
				}
				break;
			case 'BoolLiteral':
				// 불린 리터럴 하이라이팅
				if (exprData?.location) {
					decorations.push({
						range: this.locationToRange(exprData.location, monaco),
						className: 'sevenmark-expr-bool',
						hoverMessage: `Boolean: ${exprData.value}`
					});
				}
				break;
			case 'Null':
				// null 하이라이팅
				if (exprData?.location) {
					decorations.push({
						range: this.locationToRange(exprData.location, monaco),
						className: 'sevenmark-expr-null',
						hoverMessage: 'Null'
					});
				}
				break;
		}
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
				// Expression 타입들은 processExpression에서 처리하므로 건너뜀
				if (
					elementData &&
					elementData.location &&
					!['Text', 'NewLine', 'HLine'].includes(elementType) &&
					!EXPRESSION_TYPES.has(elementType)
				) {
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

				// IfElement와 Conditional의 condition Expression 처리
				// (Expression 타입은 EXPRESSION_TYPES에서 건너뛰므로 명시적 처리 필요)
				if (
					(elementType === 'IfElement' || elementType === 'Conditional') &&
					elementData?.condition
				) {
					this.processExpression(elementData.condition, monaco, decorations);
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
