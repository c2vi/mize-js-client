


async function main(so){

	//get render
	let first = await import("/$api/render/first")
	first = first.First
	customElements.define("mize-first", first);
	const mize = document.getElementById("mize")
	const item_element = document.createElement("mize-first");
	console.log(item_element)
	mize.appendChild(item_element)

	// testing
	let n = 832
	console.log(n)
	let number_array = []
	number_array.push(n / 256)
	number_array.push(n % 256)
	let num_u8 = new Uint8Array(number_array)
	so.send(num_u8)
}


async function handle_message(message){	
	const number_array = await message.data.arrayBuffer()
	let arr = new Uint8Array(number_array)
	console.log(arr.reverse())
	let count = 1
	let num = 0
	for (i of arr) {
		num += count * i * 256
	}
	console.log("NUM: " + num)
}

document.addEventListener("DOMContentLoaded", () =>{
	const so = new WebSocket("ws://localhost:3000/$api/socket")
	so.onopen = () => {
		so.onmessage = (message) => {
			handle_message(message)
		}
		main(so)
	}
})




