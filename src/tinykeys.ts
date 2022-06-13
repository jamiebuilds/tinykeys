/**
 * A map of keybinding strings to event handlers.
 */
export interface KeyBindingMap {
	[keybinding: string]: (event: KeyboardEvent) => void
}

export interface KeyBindingHandlerOptions {
	/**
	 * Keybinding sequences will wait this long between key presses before
	 * cancelling (default: 1000).
	 *
	 * **Note:** Setting this value too low (i.e. `300`) will be too fast for many
	 * of your users.
	 */
	timeout?: number
}

/**
 * Options to configure the behavior of keybindings.
 */
export interface KeyBindingOptions extends KeyBindingHandlerOptions {
	/**
	 * Key presses will listen to this event (default: "keydown").
	 */
	event?: "keydown" | "keyup"
}

/**
 * These are the modifier keys that change the meaning of keybindings.
 *
 * Note: Ignoring "AltGraph" because it is covered by the others.
 */
const KEYBINDING_MODIFIER_KEYS = ["Shift", "Meta", "Alt", "Control"]

/**
 * Keybinding sequences should timeout if individual key presses are more than
 * 1s apart by default.
 */
const DEFAULT_TIMEOUT = 1000

/**
 * Keybinding sequences should bind to this event by default.
 */
const DEFAULT_EVENT = "keydown"

/**
 * An alias for creating platform-specific keybinding aliases.
 */
const MOD =
	typeof navigator === "object" &&
	/Mac|iPod|iPhone|iPad/.test(navigator.platform)
		? "Meta"
		: "Control"

/**
 * There's a bug in Chrome that causes event.getModifierState not to exist on
 * KeyboardEvent's for F1/F2/etc keys.
 */
function getModifierState(event: KeyboardEvent, mod: string) {
	return typeof event.getModifierState === "function"
		? event.getModifierState(mod)
		: false
}

/**
 * Parses a "Key Binding String" into its parts.
 *
 * E.g.
 *
 * Given the key binding string of "$mod+Alt+s Shift+a" on
 * a macOS computer:
 * - [{ mods: ["Meta", "Alt"], key: "s" }, { mods: ["Shift"], key: "a" }]
 */
export function parseKeybinding(binding: string) {
	return binding
		.trim()
		.split(" ")
		.map(press => {
			let mods = press.split(/\b\+/)
			const key = mods.pop() as string
			mods = mods.map(mod => (mod === "$mod" ? MOD : mod))
			return { mods, key }
		})
}

function arraysAreEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false

	return a.every(c => b.includes(c))
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
 * window.addEvenListener("keydown", handler)
 * ```
 */
export function createKeybindingsHandler(
	keyBindingMap: KeyBindingMap,
	options: KeyBindingHandlerOptions = {},
): EventListener {
	const timeout = options.timeout ?? DEFAULT_TIMEOUT

	const keyBindings = Object.entries(keyBindingMap).map(
		([key, entry]) => [parseKeybinding(key), entry] as const,
	)

	// To support sequence-style hotkeys, every time the user
	// presses a key we parse that key and add it to the
	// currentSequence.
	//
	// Example:
	// 1. User presses "g"
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	// 2. 500ms later user presses and holds "Alt".
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt"], key: "Alt", code: "AltLeft" }
	// 3. 500ms later user presses and holds "Meta".
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt", "Meta"], key: "Meta", code: "MetaLeft" }
	// 4. 200ms later user releases "Alt"
	// 5. 500ms later user presses "s"
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt", "Meta"], key: "Meta", code: "MetaLeft" }
	//    - { mods: ["Meta"], key: "s", code: "KeyS" }
	// 6. 500ms later user presses "a"
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt", "Meta"], key: "Meta", code: "MetaLeft" }
	//    - { mods: ["Meta"], key: "s", code: "KeyS" }
	//    - { mods: ["Meta"], key: "a", code: "KeyA" }
	// 7. 200ms later user releases "Meta"
	// 8. 500ms later user presses (and releases) "Meta"
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt", "Meta"], key: "Meta", code: "MetaLeft" }
	//    - { mods: ["Meta"], key: "s", code: "KeyS" }
	//    - { mods: ["Meta"], key: "a", code: "KeyA" }
	//    - { mods: ["Meta"], key: "Meta", code: "MetaLeft" }
	// 9. 500ms later user presses "a"
	//    - currentSequence is an array containing:
	//    - { mods: [], key: "g", code: "KeyG" }
	//    - { mods: ["Alt", "Meta"], key: "Meta", code: "MetaLeft" }
	//    - { mods: ["Meta"], key: "s", code: "KeyS" }
	//    - { mods: ["Meta"], key: "a", code: "KeyA" }
	//    - { mods: ["Meta"], key: "Meta", code: "MetaLeft" }
	//    - { mods: [], key: "a", code: "KeyA" }
	// 10. 1000ms later user hasn't pressed anything else so
	//     the currentSequence is reset by a `setTimeout()`.
	//    - currentSequence === []
	let currentSequence: Array<{
		mods: string[]
		key: string
		code: string
	}> = []

	const timeoutsStore = new Set<number>()

	return event => {
		// Ensure and stop any event that isn't a full keyboard event.
		// Autocomplete option navigation and selection would fire a instanceof Event,
		// instead of the expected KeyboardEvent
		if (!(event instanceof KeyboardEvent)) {
			return
		}

		timeoutsStore.forEach(timeoutId => clearTimeout(timeoutId))
		timeoutsStore.clear()

		const currentMods = KEYBINDING_MODIFIER_KEYS.filter(key =>
			getModifierState(event, key),
		)

		const prevKeypressInSequence = currentSequence.at(-1)

		const wasPrevKeyAModifier = prevKeypressInSequence
			? KEYBINDING_MODIFIER_KEYS.includes(prevKeypressInSequence.key)
			: false

		if (
			wasPrevKeyAModifier &&
			// Will always be non-null when `wasPrevKeyAModifier === true`.
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			prevKeypressInSequence!.mods.every(key => currentMods.includes(key))
		) {
			// in this case, we'll replace the previous entry with
			// the current one.
			currentSequence.pop()
		}

		currentSequence.push({
			mods: currentMods,
			key: event.key,
			code: event.code,
		})

		const matchedBindings: typeof keyBindings = []

		/**
		 * A keybinding is *either* "matched" or "possibly matched"
		 * or "not matched".
		 */
		const possibleMatchedBindings: typeof keyBindings = []

		keyBindings.forEach(keyBinding => {
			const [bindingSequence] = keyBinding

			const isPotentialMatch = currentSequence.every(
				(currentSequencePart, index) => {
					const keyBindingPart = bindingSequence.at(index)

					if (
						!keyBindingPart ||
						!arraysAreEqual(keyBindingPart.mods, currentSequencePart.mods)
					) {
						return false
					}

					return (
						keyBindingPart.key === currentSequencePart.key ||
						keyBindingPart.key === currentSequencePart.code
					)
				},
			)

			if (!isPotentialMatch) return

			if (currentSequence.length !== bindingSequence.length) {
				possibleMatchedBindings.push(keyBinding)
			} else {
				matchedBindings.push(keyBinding)
			}
		})

		if (possibleMatchedBindings.length === 0) {
			currentSequence = []

			matchedBindings.forEach(keyBinding => {
				const [, callback] = keyBinding
				callback(event)
			})

			return
		}

		matchedBindings.forEach(keyBinding => {
			const [, callback] = keyBinding

			const timeoutId = setTimeout(
				callback,
				timeout,
				event,
			) as unknown as number

			timeoutsStore.add(timeoutId)
		})

		setTimeout(() => {
			currentSequence = []
			timeoutsStore.clear()
		}, timeout)
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
	keyBindingMap: KeyBindingMap,
	options: KeyBindingOptions = {},
): () => void {
	let event = options.event ?? DEFAULT_EVENT
	let onKeyEvent = createKeybindingsHandler(keyBindingMap, options)

	target.addEventListener(event, onKeyEvent)

	return () => {
		target.removeEventListener(event, onKeyEvent)
	}
}
