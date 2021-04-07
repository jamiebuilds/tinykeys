type KeyBindingPress = [string, string[], string]
type KeyBindingCallback = (event: KeyboardEvent) => void

/**
 * A map of keybinding strings to event handlers.
 */
export interface KeyBindingMap {
	[keybinding: string]: KeyBindingMap | KeyBindingCallback
}

/**
 * These are the modifier keys that change the meaning of keybindings.
 *
 * Note: Ignoring "AltGraph" because it is covered by the others.
 */
let KEYBINDING_MODIFIER_KEYS = ["Shift", "Meta", "Alt", "Control"]

/**
 * Keybinding sequences should timeout if individual key presses are more than
 * 1s apart.
 */
let TIMEOUT = 1000

/**
 * An alias for creating platform-specific keybinding aliases.
 */
let MOD =
	typeof navigator === "object" &&
	/Mac|iPod|iPhone|iPad/.test(navigator.platform)
		? "Meta"
		: "Control"

/**
 * Parses a "Key Binding String" into its parts
 *
 * grammar    = `<press>`
 * <press>    = `<key>` or `<mods>+<key>`
 * <mods>     = `<mod>+<mod>+...`
 */
function parse(str: string): KeyBindingPress {
	let mods = str.split("+").map(part => part.trim())
	let key = mods.pop() as string
	mods = mods.map(mod => (mod === "$mod" ? MOD : mod))
	return [str, mods, key]
}

/**
 * This tells us if a series of events matches a key binding sequence either
 * partially or exactly.
 */
function match(event: KeyboardEvent, press: KeyBindingPress): boolean {
	// prettier-ignore
	return !(
		// Allow either the `event.key` or the `event.code`
		// MDN event.key: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
		// MDN event.code: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
		(
			press[2].toUpperCase() !== event.key.toUpperCase() &&
			press[2] !== event.code
		) ||

		// Ensure all the modifiers in the keybinding are pressed.
		press[1].find(mod => {
			return !event.getModifierState(mod)
		}) ||

		// KEYBINDING_MODIFIER_KEYS (Shift/Control/etc) change the meaning of a
		// keybinding. So if they are pressed but aren't part of the current
		// keybinding press, then we don't have a match.
		KEYBINDING_MODIFIER_KEYS.find(mod => {
			return !press[1].includes(mod) && press[2] !== mod && event.getModifierState(mod)
		})
	)
}

/**
 * Subscribes to keybindings.
 *
 * Returns an unsubscribe method.
 *
 * @example
 * ```js
 * import keybindings from "../src/keybindings"
 *
 * keybindings(window, {
 * 	"Shift+d": () => {
 * 		alert("The 'Shift' and 'd' keys were pressed at the same time")
 * 	},
 * 	"y e e t": () => {
 * 		alert("The keys 'y', 'e', 'e', and 't' were pressed in order")
 * 	},
 * 	"$mod+d": () => {
 * 		alert("Either 'Control+d' or 'Meta+d' were pressed")
 * 	},
 * })
 * ```
 */
export default function keybindings(
	target: Window | HTMLElement,
	keyBindingMap: KeyBindingMap,
): () => void {
	let timer: NodeJS.Timeout | null = null
	let currentScope = keyBindingMap

	let onKeyDown: EventListener = event => {
		let target =
			typeof event.composedPath === "function"
				? event.composedPath()[0]
				: event.target

		// Ensure and stop any event that isn't a full keyboard event.
		// Autocomplete option navigation and selection would fire a instanceof Event,
		// instead of the expected KeyboardEvent
		if (!(event instanceof KeyboardEvent)) {
			return
		}

		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT")
		) {
			return
		}

		let currentScopeKeyBindings = Object.keys(currentScope).map(parse)
		let matchedScope

		for (let index = 0; index < currentScopeKeyBindings.length; index++) {
			let press = currentScopeKeyBindings[index]
			let value = currentScope[press[0]]

			if (match(event, press)) {
				if (typeof value === "function") {
					value(event)
					currentScope = keyBindingMap
				} else {
					matchedScope = value
				}
			}
		}

		if (matchedScope) {
			currentScope = matchedScope
		} else if (!event.getModifierState(event.key)) {
			// Modifier keydown events shouldn't break sequences
			// Note: The above works because:
			// - non-modifiers will always return false
			// - if the current keypress is a modifier then it will return true when we check its state
			// MDN: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState
			currentScope = keyBindingMap
		}

		if (timer) {
			clearTimeout(timer)
		}

		timer = setTimeout(() => {
			currentScope = keyBindingMap
		}, TIMEOUT)
	}

	target.addEventListener("keydown", onKeyDown)

	return () => {
		target.removeEventListener("keydown", onKeyDown)
	}
}
