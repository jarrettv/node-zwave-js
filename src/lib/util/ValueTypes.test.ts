/// <reference types="jest-extended" />
import { assertZWaveError } from "../../../test/util";
import { ZWaveErrorCodes } from "../error/ZWaveError";
import { encodeFloatWithScale, parseBoolean, parseFloatWithScale, parseMaybeBoolean, parseMaybeNumber, parseNumber, unknownBoolean, unknownNumber } from "./ValueTypes";

describe("lib/util/ValueTypes", () => {

	describe("parseBoolean()", () => {
		it("should return false when the value is 0", () => {
			expect(parseBoolean(0)).toBeFalse();
		});

		it("should return true when the value is 0xff", () => {
			expect(parseBoolean(0xff)).toBeTrue();
		});

		it("should return undefined otherwise", () => {
			expect(parseBoolean(0x80)).toBeUndefined();
		});
	});

	describe("parseMaybeBoolean()", () => {
		it("should return false when the value is 0", () => {
			expect(parseMaybeBoolean(0)).toBeFalse();
		});

		it("should return true when the value is 0xff", () => {
			expect(parseMaybeBoolean(0xff)).toBeTrue();
		});

		it("should return unknown when the value is 0xfe", () => {
			expect(parseMaybeBoolean(0xfe)).toBe(unknownBoolean);
		});

		it("should return undefined otherwise", () => {
			expect(parseMaybeBoolean(0x80)).toBeUndefined();
		});
	});

	describe("parseNumber()", () => {
		it("should return the value when it is in the range 0..100", () => {
			for (let i = 0; i <= 100; i++) {
				expect(parseNumber(i)).toBe(i);
			}
		});

		it("should return 100 when the value is 0xff", () => {
			expect(parseNumber(0xff)).toBe(100);
		});

		it("should return undefined otherwise", () => {
			expect(parseNumber(0x80)).toBeUndefined();
		});
	});

	describe("parseMaybeNumber()", () => {
		it("should return the value when it is in the range 0..100", () => {
			for (let i = 0; i <= 100; i++) {
				expect(parseMaybeNumber(i)).toBe(i);
			}
		});

		it("should return 100 when the value is 0xff", () => {
			expect(parseMaybeNumber(0xff)).toBe(100);
		});

		it("should return unknown when the value is 0xfe", () => {
			expect(parseMaybeNumber(0xfe)).toBe(unknownNumber);
		});

		it("should return undefined otherwise", () => {
			expect(parseMaybeNumber(0x80)).toBeUndefined();
		});
	});

	describe("parseFloatWithScale()", () => {
		it("should correctly extract the scale", () => {
			const tests = [
				{ payload: Buffer.from([0b00000001, 0]), expected: 0b00 },
				{ payload: Buffer.from([0b00001001, 0]), expected: 0b01 },
				{ payload: Buffer.from([0b00010001, 0]), expected: 0b10 },
				{ payload: Buffer.from([0b00011001, 0]), expected: 0b11 },
			];
			for (const { payload, expected } of tests) {
				expect(parseFloatWithScale(payload).scale).toBe(expected);
			}
		});

		it("should correctly extract the value", () => {
			const tests = [
				{ payload: Buffer.from([0b00100001, 15]), expected: 1.5, numDigits: 1 },
				{ payload: Buffer.from([0b11001100, 0x81, 0x23, 0x45, 0x67]), expected: -2128.394905, numDigits: 6 },
			];
			for (const { payload, expected, numDigits } of tests) {
				expect(parseFloatWithScale(payload).value).toBeCloseTo(expected, numDigits);
			}
		});
	});

	describe("encodeFloatWithScale()", () => {
		it("should correctly encode the scale", () => {
			const tests = [
				{ scale: 0b00, value: 0, expected: Buffer.from([0b00000001, 0]) },
				{ scale: 0b01, value: 0, expected: Buffer.from([0b00001001, 0]) },
				{ scale: 0b10, value: 0, expected: Buffer.from([0b00010001, 0]) },
				{ scale: 0b11, value: 0, expected: Buffer.from([0b00011001, 0]) },
			];
			for (const { scale, value, expected } of tests) {
				expect(encodeFloatWithScale(value, scale).equals(expected)).toBeTrue();
			}
		});

		it("should correctly determine the minimum necessary size", () => {
			const tests = [
				{ value: 0, expected: 1 },
				{ value: -1, expected: 1 },
				{ value: -128, expected: 1 },
				{ value: 128, expected: 2 },
				{ value: -32768, expected: 2 },
				{ value: 32768, expected: 4 },
			];
			for (const { value, expected } of tests) {
				expect(encodeFloatWithScale(value, 0).length).toBe(expected + 1);
			}
		});

		it("should correctly detect the necessary precision and serialize the given values", () => {
			const tests = [
				{ value: 1.5, scale: 0b00, expected: Buffer.from([0b00100001, 15]) },
				{ value: -2128.394905, scale: 0b01, expected: Buffer.from([0b11001100, 0x81, 0x23, 0x45, 0x67]) },
			];
			for (const { scale, value, expected } of tests) {
				expect(encodeFloatWithScale(value, scale).equals(expected)).toBeTrue();
			}
		});

		it("should throw when the value cannot be represented in 4 bytes", () => {
			assertZWaveError(
				() => encodeFloatWithScale(0xffffffff, 0),
				{ errorCode: ZWaveErrorCodes.Arithmetic },
			);
			assertZWaveError(
				() => encodeFloatWithScale(Number.NaN, 0),
				{ errorCode: ZWaveErrorCodes.Arithmetic },
			);
		});

	});

});
