import confetti from "canvas-confetti"
import { tinykeys } from "../src/tinykeys"

tinykeys(window, {
	"Shift+D": () => {
		alert("The 'Shift' and 'd' keys were pressed at the same time")
	},
	"y e e t": () => {
		alert("The keys 'y', 'e', 'e', and 't' were pressed in order")
	},
	"$mod+KeyU": () => {
		alert("Either 'Control+u' or 'Meta+u' were pressed")
	},
})

const KonamiCode = [
	"ArrowUp",
	"ArrowUp",
	"ArrowDown",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowLeft",
	"ArrowRight",
	"KeyB",
	"KeyA",
	"Enter",
].join(" ")

tinykeys(window, {
	[KonamiCode]: () => {
		const duration = 15 * 1000
		const animationEnd = Date.now() + duration
		const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

		function randomInRange(min: number, max: number) {
			return Math.random() * (max - min) + min
		}

		const interval = setInterval(() => {
			const timeLeft = animationEnd - Date.now()

			if (timeLeft <= 0) {
				return clearInterval(interval)
			}

			const particleCount = 50 * (timeLeft / duration)
			// since particles fall down, start a bit higher than random
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
			})
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
			})
		}, 250)
	},
})
