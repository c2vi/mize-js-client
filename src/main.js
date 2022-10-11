
pr = console.log

async function main(so){

	//get render
	let first = await import("/$api/render/first")
	first = first.First
	customElements.define("mize-first", first);
	const mize = document.getElementById("mize")
	const item_element = document.createElement("mize-first");
	mize.appendChild(item_element)

	let num_u8 = new Uint8Array([1,1,0,0,0,0,0,0,0,0])
	so.send(num_u8)
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
			const id = from_be_bytes(message.slice(2, 10))
			const num_of_fields = from_be_bytes(message.slice(10, 14))
			let item_u8 = []
			let item = []

			let index = 14
			let fields = 0
			while (fields < num_of_fields) {
				const key_len = from_be_bytes(message.slice(index + 0, index + 4))
				const key = message.slice(index + 4, index + 4 + key_len)

				index += 4 + key_len

				const val_len = from_be_bytes(message.slice(index + 0, index + 4))
				const val = message.slice(index + 4, index + 4 + val_len)

				const key_str = String.fromCharCode.apply(null, key);
				const val_str = String.fromCharCode.apply(null, val);

				item_u8.push([key, val])
				item.push([key_str, val_str])

				index += 4 + val_len

				fields += 1
			}
			for (f of item) {
				//console.log(f)
				console.log("Key: ", f[0])
				console.log("Val: ", f[1])
			}

			//console.log("num_of_fields: " + num_of_fields)
			//console.log("ID: " , id)
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

function from_be_bytes(bytes){
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


function u32_to_be_bytes(num){
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
	while (bytes.length < 4){
		bytes.push(0)
	}

	return new Uint8Array(bytes.reverse())
}


