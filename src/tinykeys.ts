/**
 * A single press of a keybinding sequence.
 */
export type KeybindingPress = readonly [
	requiredModifiers: ReadonlyArray<string>,
	optionalModifiers: ReadonlyArray<string>,
	key: string | RegExp,
]

/**
 * Keyboard event callback fired when keybinding is triggered.
 */
export type KeybindingHandler = (event: KeyboardEvent) => void

/**
 * A map of keybinding strings to event handlers.
 */
export type KeybindingsMap = Record<string, KeybindingHandler>

/**
 * Predicate that returns true if a keyboard event should be ignored.
 */
export type KeybindingFilter = (event: KeyboardEvent) => boolean

export interface KeybindingHandlerOptions {
	/**
	 * Keybinding sequences will wait this long between key presses before
	 * cancelling (default: 1000).
	 *
	 * **Note:** Setting this value too low (i.e. `300`) will be too fast for many
	 * of your users.
	 */
	timeout?: number

	/**
	 * Customize the behavior of which keyboard events will be ignored/skipped.
	 *
	 * By default this uses the behavior of {@link defaultKeybindingsHandlerIgnore}.
	 *
	 * @example Allow all events
	 * ```tsx
	 * tinykeys(window, {...}, {
	 *   ignore: () => false
	 * })
	 * ```
	 *
	 * @example Extend the default ignore
	 * ```tsx
	 * tinykeys(window, {...}, {
	 *   ignore: event => {
	 *     return (
	 *       // Also ignore events inside a dialog
	 *       event.target.closest("dialog") != null &&
	 *       defaultKeybindingsHandlerIgnore(event)
	 *     );
	 *   }
	 * })
	 * ```
	 */
	ignore?: KeybindingFilter
}

/**
 * Options to configure the behavior of keybindings.
 */
export interface KeybindingOptions extends KeybindingHandlerOptions {
	/**
	 * Key presses will listen to this event (default: "keydown").
	 */
	event?: "keydown" | "keyup"

	/**
	 * Key presses will use a capture listener (default: false)
	 */
	capture?: boolean
}

/**
 * These are the modifier keys that change the meaning of keybindings.
 *
 * Note: Ignoring "AltGraph" because it is covered by the others.
 */
let KEYBINDING_MODIFIER_KEYS = ["Shift", "Meta", "Alt", "Control"]

/**
 * Keybinding sequences should timeout if individual key presses are more than
 * 1s apart by default.
 */
let DEFAULT_TIMEOUT = 1000

/**
 * Keybinding sequences should bind to this event by default.
 */
let DEFAULT_EVENT = "keydown" as const

/**
 * Platform detection code.
 * @see https://github.com/jamiebuilds/tinykeys/issues/184
 */
let PLATFORM = typeof navigator === "object" ? navigator.platform : ""
let APPLE_DEVICE = /Mac|iPod|iPhone|iPad/.test(PLATFORM)

/**
 * An alias for creating platform-specific keybinding aliases.
 */
let MOD = APPLE_DEVICE ? "Meta" : "Control"

/**
 * Meaning of `AltGraph`, from MDN:
 * - Windows: Both Alt and Ctrl keys are pressed, or AltGr key is pressed
 * - Mac: ⌥ Option key pressed
 * - Linux: Level 3 Shift key (or Level 5 Shift key) pressed
 * - Android: Not supported
 * @see https://github.com/jamiebuilds/tinykeys/issues/185
 */
let ALT_GRAPH_ALIASES =
	PLATFORM === "Win32" ? ["Control", "Alt"] : APPLE_DEVICE ? ["Alt"] : []

/**
 * Ensure and stop any event that isn't a full keyboard event.
 * Autocomplete option navigation and selection would fire an Event,
 * instead of the expected KeyboardEvent
 */
function isKeyboardEvent(
	event: Partial<KeyboardEvent>,
): event is KeyboardEvent {
	return !!(event.key && event.code && event.getModifierState)
}

/**
 * Ignores keyboard events from contenteditable and form elements unless they
 * are the current target.
 */
export function defaultKeybindingsHandlerIgnore(event: KeyboardEvent) {
	let target = event.target as HTMLElement
	return (
		// Always allow the current target
		target !== event.currentTarget &&
		// Ignore contenteditable and form elements
		target.matches("[contenteditable],input,select,textarea")
	)
}

/**
 * There's a bug in Chrome that causes event.getModifierState not to exist on
 * KeyboardEvent's for F1/F2/etc keys.
 */
function getModifierState(event: KeyboardEvent, mod: string) {
	return typeof event.getModifierState === "function"
		? event.getModifierState(mod) ||
				(ALT_GRAPH_ALIASES.includes(mod) && event.getModifierState("AltGraph"))
		: false
}

/**
 * Parses a keybinding string into its parts.
 *
 * ```
 * grammar    = `<sequence>`
 * <sequence> = `<press> <press> <press> ...`
 * <press>    = `<key>` or `<mods>+<key>`
 * <mods>     = `<mod>+<mod>+...`
 * <mod>      = `<modifier>` (required) or `[<modifier>]` (optional)
 * <key>      = `<KeyboardEvent.key>` or `<KeyboardEvent.code>` (case-insensitive)
 * <key>      = `(<regex>)` -> `/^(?:<regex>)$/iy` (case-insensitive)
 * ```
 */
export function parseKeybinding(str: string): KeybindingPress[] {
	return str
		.trim()
		.split(" ")
		.map(press => {
			let parts = press.split(/(?<=\w|\])\+/)

			let last: string | RegExp = parts.pop() as string
			let regex = last.match(/^\((.+)\)$/)
			let key = regex ? new RegExp(`^(?:${regex[1]})$`, "iv") : last

			let requiredModifiers: string[] = []
			let optionalModifiers: string[] = []

			for (const part of parts) {
				let optional = part.match(/^\[(.*)\]$/)
				let mod = optional?.[1] ?? part
				mod = mod === "$mod" ? MOD : mod
				if (optional) {
					optionalModifiers.push(mod)
				} else {
					requiredModifiers.push(mod)
				}
			}

			return [requiredModifiers, optionalModifiers, key]
		})
}

/**
 * This tells us if a single keyboard event matches a single keybinding press.
 */
export function matchKeybindingPress(
	event: KeyboardEvent,
	[requiredModifiers, optionalModifiers, key]: KeybindingPress,
): boolean {
	// prettier-ignore
	return !(
		// Allow either the `event.key` or the `event.code`
		// MDN event.key: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
		// MDN event.code: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
		(
			key instanceof RegExp ? !(key.test(event.key) || key.test(event.code)) :
			(key.toUpperCase() !== event.key.toUpperCase() &&
			key !== event.code)
		) ||

		// Ensure all required modifiers in the keybinding are pressed.
		requiredModifiers.find(mod => {
			return !getModifierState(event, mod)
		}) ||

		// KEYBINDING_MODIFIER_KEYS (Shift/Control/etc) change the meaning of a
		// keybinding. So if they are pressed but aren't part of the current
		// keybinding press, then we don't have a match.
		KEYBINDING_MODIFIER_KEYS.find(mod => {
			return (
				!requiredModifiers.includes(mod) &&
				!optionalModifiers.includes(mod) &&
				key !== mod &&
				getModifierState(event, mod)
			);
		})
	)
}

/**
 * Creates an event listener for handling keybindings.
 *
 * @example
 * ```js
 * import { createKeybindingsHandler } from "../src/keybindings"
 *
 * let handler = createKeybindingsHandler({
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
 *
 * window.addEventListener("keydown", handler)
 * ```
 */
export function createKeybindingsHandler(
	keybindingsMap: KeybindingsMap,
	options: KeybindingHandlerOptions = {},
): EventListener {
	let timeout = options.timeout ?? DEFAULT_TIMEOUT
	let ignore = options.ignore ?? defaultKeybindingsHandlerIgnore

	let keybindings = Object.keys(keybindingsMap).map(input => {
		return [input, parseKeybinding(input), keybindingsMap[input]] as const
	})

	let pending = new Map<string, KeybindingPress[]>()
	let timer: number | null = null

	return event => {
		if (!isKeyboardEvent(event) || ignore(event)) {
			return
		}

		let conflicts: Array<string> = []
		for (let [input, sequence, handler] of keybindings) {
			let prev = pending.get(input)
			let expected = prev ? prev : sequence
			let [current, ...rest] = expected

			let matches = matchKeybindingPress(event, current)

			if (!matches) {
				// Modifier keydown events shouldn't break sequences
				// Note: This works because:
				// - non-modifiers will always return false
				// - if the current keypress is a modifier then it will return true when we check its state
				// MDN: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState
				if (!getModifierState(event, event.key)) {
					pending.delete(input)
				}
			} else if (rest.length > 0) {
				pending.set(input, rest)
				conflicts.push(input)
			} else {
				pending.delete(input)
				if (conflicts.length) {
					console.warn(
						`tinykeys: Conflict found, "${input}" did not fire, waiting for:`,
						conflicts,
					)
				} else {
					handler(event)
					break
				}
			}
		}

		if (timer) {
			clearTimeout(timer)
		}

		timer = setTimeout(() => pending.clear(), timeout)
	}
}

/**
 * Subscribes to keybindings.
 *
 * Returns an unsubscribe method.
 *
 * @example
 * ```js
 * import { tinykeys } from "../src/tinykeys"
 *
 * tinykeys(window, {
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
export function tinykeys(
	target: Window | HTMLElement,
	keybindingMap: KeybindingsMap,
	options: KeybindingOptions = {},
): () => void {
	let event = options.event ?? DEFAULT_EVENT
	let onKeyEvent = createKeybindingsHandler(keybindingMap, options)
	target.addEventListener(event, onKeyEvent, options.capture)
	return () => {
		target.removeEventListener(event, onKeyEvent, options.capture)
	}
}
