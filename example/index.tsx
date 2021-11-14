import tinykeys from "../src/tinykeys"

tinykeys(window, {
	"Shift+D": () => {
		alert("The 'Shift' and 'd' keys were pressed at the same time")
	},
	"y e e t": () => {
		alert("The keys 'y', 'e', 'e', and 't' were pressed in order")
	},
	"$mod+KeyD": () => {
		alert("Either 'Control+d' or 'Meta+d' were pressed")
	},
	"?": () => {
		alert("The key '?' was pressed")
	},
})
