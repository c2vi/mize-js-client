


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
	//let n = 832
	//let number_array = []
	//number_array.push(n / 256)
	//number_array.push(n % 256)

	let num_u8 = new Uint8Array([1,2,0,0,0,0,0,0,2,5,3])
	so.send(num_u8)
}


async function handle_message(message){	
	const version = message[0]
	const cmd = message[1]
	console.log("CMD: " + cmd)

	switch(cmd){
		case 1:
			break;

		case 2:
			const id = convert_to_num(message.slice(2, 10))
			console.log("ID: " , id)
			break;

		case 3:
			break;

		case 4:
			break;

		case 5:
			break;

		case 6:
			break;

		case 7:
			break;

		case 8:
			break;

		case 9:
			break;

		case 10:
			break;

		case 11:
			break;

		case 12:
			break;

	}
	//const number_array = await message.data.arrayBuffer()
	//let arr = new Uint8Array(number_array)
}

document.addEventListener("DOMContentLoaded", () =>{
	const so = new WebSocket("ws://localhost:3000/$api/socket")
	so.onopen = () => {
		so.onmessage = async (message) => {
			handle_message(new Uint8Array(await message.data.arrayBuffer()))
		}
		main(so)
	}
})

function convert_to_num(bytes){
	bytes = bytes.reverse()
	console.log(bytes)
	let count = 0
	let num = 0
	for (i of bytes) {
		num += i * 256 ** count
		count += 1
	}
	return num;
}

function convert_to_bytes(num){
}




