


async function main(so){

	//get render
	let first = await import("/$api/render/first")
	first = first.First
	customElements.define("mize-first", first);
	const mize = document.getElementById("mize")
	const item_element = document.createElement("mize-first");
	mize.appendChild(item_element)

	// testing
	//let n = 832
	//let number_array = []
	//number_array.push(n / 256)
	//number_array.push(n % 256)

	//let num_u8 = new Uint8Array([1,1,0,0,0,0,0,0,0,0])
	//so.send(num_u8)
	let bytes = u64_to_be_bytes(12345678)
	let number = be_bytes_to_u64(new Uint8Array(bytes))
	console.log("Bytes: " + bytes)
	console.log("Num: " + number)
}


async function handle_message(message){	
	const version = message[0]
	const cmd = message[1]

	//console.log("CMD: " + cmd)
	//console.log("MSG: " + message)

	switch(cmd){
		case 1:
			break;

		case 2:
			const id = be_bytes_to_u64(message.slice(2, 10))
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

function be_bytes_to_u64(bytes){
	bytes = bytes.reverse()
	let count = 0
	let num = 0
	for (i of bytes) {
		num += i * 256 ** count
		count += 1
	}
	return num;
}

function u64_to_be_bytes(num){
	//let bytes = new Uint8Array([]);
	let bytes = []

	//compute digits
	while (true){
		let digit = num % 256

		if (digit == 0 ){
			break
		}

		bytes.push(digit)
		num = (num - digit) / 256
	}

	//fill array with 0s
	while (bytes.length < 8){
		bytes.push(0)
	}

	return new Uint8Array(bytes.reverse())
}




