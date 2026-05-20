import { expect, test, vi, onTestFinished } from "vitest"
import { userEvent } from "vitest/browser"
import {
	tinykeys,
	type KeybindingsMap,
	type KeybindingOptions,
} from "../src/tinykeys.js"

function $el(tagName: string, attrs: Record<string, string> = {}) {
	let element = document.createElement(tagName)
	for (const [key, value] of Object.entries(attrs)) {
		element.setAttribute(key, value)
	}
	document.body.appendChild(element)
	onTestFinished(() => element.remove())
	return element
}

function $tinykeys(
	target: Window | HTMLElement,
	keybindingsMap: KeybindingsMap,
	options?: KeybindingOptions,
) {
	let unsubscribe = tinykeys(target, keybindingsMap, options)
	onTestFinished(unsubscribe)
}

test.describe("tinykeys()", () => {
	test.describe("single press", () => {
		test("KeyboardEvent.key", async () => {
			let cb = vi.fn()
			$tinykeys(window, { a: cb })
			await userEvent.keyboard("a")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("KeyboardEvent.code", async () => {
			let cb = vi.fn()
			$tinykeys(window, { KeyA: cb })
			await userEvent.keyboard("a")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("regex key", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "(F[1-9])": cb })
			await userEvent.keyboard("{F1}")
			expect(cb).toHaveBeenCalledOnce()
		})
	})

	test.describe("key sequences", () => {
		test("typing a full sequence", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "y e e t": cb })
			await userEvent.keyboard("yeet")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("typing a partial sequence", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "y e e t": cb })
			await userEvent.keyboard("yee")
			expect(cb).not.toHaveBeenCalled()
		})
	})

	test("keyup event", async () => {
		let cb = vi.fn()
		$tinykeys(window, { a: cb }, { event: "keyup" })
		await userEvent.keyboard("a")
		expect(cb).toHaveBeenCalledOnce()
	})

	test.describe("modifiers", () => {
		test("shift", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Shift+a": cb })
			await userEvent.keyboard("{Shift>}{a}{/Shift}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("meta", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Meta+a": cb })
			await userEvent.keyboard("{Meta>}{a}{/Meta}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("alt", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Alt+a": cb })
			await userEvent.keyboard("{Alt>}{a}{/Alt}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("control", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Control+a": cb })
			await userEvent.keyboard("{Control>}{a}{/Control}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("multiple modifiers", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Shift+Control+a": cb })
			await userEvent.keyboard("{Shift>}{Control>}{a}{/Control}{/Shift}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("extra modifier prevents match", async () => {
			let cb = vi.fn()
			$tinykeys(window, { a: cb })

			await userEvent.keyboard("{Shift>}{a}{/Shift}")
			expect(cb).not.toHaveBeenCalled()
		})

		test("missing modifier prevents match", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Shift+a": cb })
			await userEvent.keyboard("a")
			expect(cb).not.toHaveBeenCalled()
		})
	})

	test.describe("optional modifiers", () => {
		test("fires without optional modifier", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "[Shift]+a": cb })
			await userEvent.keyboard("a")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("fires with optional modifier", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "[Shift]+a": cb })
			await userEvent.keyboard("{Shift>}{a}{/Shift}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("fires without optional $mod modifier", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "[$mod]+a": cb })
			await userEvent.keyboard("a")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("fires with optional $mod modifier", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "[$mod]+a": cb })
			let mod = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
				? "Meta"
				: "Control"
			await userEvent.keyboard(`{${mod}>}{a}{/${mod}}`)
			expect(cb).toHaveBeenCalledOnce()
		})

		test("required modifier still required alongside optional", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Control+[Shift]+a": cb })
			await userEvent.keyboard("{Control>}{a}{/Control}")
			expect(cb).toHaveBeenCalledOnce()
		})

		test("required modifier alongside optional modifier both pressed", async () => {
			let cb = vi.fn()
			$tinykeys(window, { "Control+[Shift]+a": cb })
			await userEvent.keyboard("{Control>}{Shift>}{a}{/Shift}{/Control}")
			expect(cb).toHaveBeenCalledOnce()
		})
	})

	test.describe("options.ignore", () => {
		test.describe("default", () => {
			async function check(element: HTMLElement) {
				let cb = vi.fn()
				$tinykeys(window, { a: cb })
				await userEvent.type(element, "a")
				expect(cb).not.toHaveBeenCalled()
			}

			test("input", () => check($el("input")))
			test("textarea", () => check($el("textarea")))
			test("select", () => check($el("select")))
			test("[contenteditable]", () =>
				check($el("div", { contenteditable: "true" })))

			test("allows the currentTarget", async () => {
				let input = $el("input")
				let cb = vi.fn()
				$tinykeys(input, { a: cb })
				await userEvent.type(input, "a")
				expect(cb).toHaveBeenCalled()
			})
		})

		test("custom ignore overrides default", async () => {
			let input = $el("input")
			let cb = vi.fn()
			$tinykeys(window, { a: cb }, { ignore: () => false })
			await userEvent.type(input, "a")
			expect(cb).toHaveBeenCalledOnce()
		})
	})

	test.describe("multiple keybindings", () => {
		test("prefer keybindings declared earlier", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				a: cb1,
				A: cb2,
			})

			await userEvent.keyboard("{KeyA}")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})

		test("prefer completion of sequence declared earlier over single press", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				"a b": cb1,
				b: cb2,
			})

			await userEvent.keyboard("ab")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})

		test("prefer continuation of sequence declared earlier over single press", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				"a b c": cb1,
				a: cb2,
			})

			await userEvent.keyboard("abc")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).toHaveBeenCalledExactlyOnceWith(
				`tinykeys: Conflict found, "a" did not fire, waiting for:`,
				["a b c"],
			)
		})

		test("prefer single press declared earlier over start of sequence", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				a: cb1,
				"a b c": cb2,
			})

			await userEvent.keyboard("abc")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})

		test("prefer single press declared earlier over continuation of sequence", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				b: cb1,
				"a b c": cb2,
			})

			await userEvent.keyboard("abc")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})

		test("prefer completion of sequence declared earlier over continuation of sequence", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				"a b": cb1,
				"a b c": cb2,
			})

			await userEvent.keyboard("abc")

			expect(cb1).toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})

		test("prefer continuation of sequence declared earlier over completion of sequence (with conflict warning)", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				"a b c": cb1,
				"a b": cb2,
			})

			await userEvent.keyboard("ab")

			expect(cb1).not.toHaveBeenCalledOnce()
			expect(cb2).not.toHaveBeenCalled()
			expect(warn).toHaveBeenCalledExactlyOnceWith(
				`tinykeys: Conflict found, "a b" did not fire, waiting for:`,
				["a b c"],
			)
		})

		test("continue tracking sequences declared later in case earlier get broken", async () => {
			let cb1 = vi.fn()
			let cb2 = vi.fn()
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {})

			$tinykeys(window, {
				"a b c": cb1,
				"b d": cb2,
			})

			await userEvent.keyboard("abd")

			expect(cb1).not.toHaveBeenCalledOnce()
			expect(cb2).toHaveBeenCalled()
			expect(warn).not.toHaveBeenCalled()
		})
	})
})
