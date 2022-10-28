
//some global stuff
pr = console.log
mize = {}
mize.encoder = new TextEncoder()
mize.decoder = new TextDecoder()

let render_classes = []
let renders= []

document.addEventListener("DOMContentLoaded", () =>{
	const so = new WebSocket("ws://localhost:3000/$api/socket")
	so.onopen = () => {
		so.onmessage = async (message) => {
			handle_message(new Uint8Array(await message.data.arrayBuffer()))
		}
		main(so)
	}
})

async function main(so){
	//get render
	let first = await import("/$api/render/first")
	first = first.First

	render_classes.push({
		id: "first",
		ob: first,
	})
	let id = parseInt(location.pathname.slice(1))
	if (location.pathname == "/") {id = 0}
	if (id == NaN) {pr("id is NaN"); id = 0}

	customElements.define("mize-first", first);
	const mize = document.getElementById("mize")
	const item_element = document.createElement("mize-first");
	renders.push({
		render_id: "first",
		ob: item_element,
		item_id: id,
	})
	item_element.so = so
	mize.appendChild(item_element)

	let num_u8 = new Uint8Array([1,1])
	num_u8 = new Uint8Array([...num_u8, ...u64_to_be_bytes(id)])
	so.send(num_u8)

}

class Item{
	constructor(id, raw){
		//raw: [["key1", "val1"]["key2", "val2"]]
		this.fields = []
		for (let field_raw of raw){
			this.fields.push(new Field(field_raw))
		}
		this.id = id
	}
}

class Field{
	constructor(raw){
		//raw: ["key", "val"]
		this.raw = raw
	}
	get str(){
		return [String.fromCharCode.apply(null, this.raw[0]), String.fromCharCode(null, this.raw[1])]
	}

	get key(){
	
		return mize.decoder.decode(this.raw[0])
	}

	get val(){
		return mize.decoder.decode(this.raw[1])
	}

	get val_as_number(){
		return from_be_bytes(this.raw[1])
	}

	get val_raw(){
		return this.raw[1]
	}

}
async function handle_message(message){	
	const version = message[0]
	const cmd = message[1]

	switch(cmd){
		case 1:
			break;

		case 2:
			let id = from_be_bytes(message.slice(2, 10))
			const num_of_fields = from_be_bytes(message.slice(10, 14))

			let raw = []

			let index = 14
			let fields = 0
			while (fields < num_of_fields) {
				const key_len = from_be_bytes(message.slice(index + 0, index + 4))
				const key = message.slice(index + 4, index + 4 + key_len)

				index += 4 + key_len

				const val_len = from_be_bytes(message.slice(index + 0, index + 4))
				const val = message.slice(index + 4, index + 4 + val_len)

				raw.push([key, val])

				index += 4 + val_len

				fields += 1
			}

			//set item on render
			let [render] = renders.filter( (render) => render.item_id == id)
			render.ob.getItemCallback(new Item(id, raw))

			
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
			decoder = new TextDecoder()
			let id_update = from_be_bytes(message.slice(2,10))
			let num_of_updates = from_be_bytes(message.slice(10, 14))
			let i = 0
			let index_update = 14
			const [render_update] = renders.filter( render => render.item_id == id_update)
			let new_item = {
				u8: Array.from(render_update.ob.item.u8),
				str: Array.from(render_update.ob.item.str),
			}
			while (i < num_of_updates) {

				//get key_len
				let key_len = from_be_bytes(message.slice(index_update, index_update + 4))
				index_update += 4

				//get key
				let key = new Uint8Array(message.slice(index_update, index_update + key_len))
				let key_str = decoder.decode(key)
				index_update += key_len

				//get update_len
				let update_len = from_be_bytes(message.slice(index_update, index_update + 4))
				
				//apply for key
				let new_val = []
				while (true) {
					let b = message[index_update]
					index_update += 1
					if (b == undefined) {break}

					//replace
					if (b == 0){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8

						const [field] = render_update.ob.item.u8.filter( field => {
							let count = 0
							while (true){
								if (field[0][count] == undefined) {break}
								if (key[count] == undefined) {break}
								if (field[0][count] != key[count]) {return}
								count += 1
							}
							return true
						})

						new_val = [
							...field[1].slice(0, start),
							...message.slice(index_update, index_update + stop-start),
							...field[1].slice(stop, -1)
						]

					//insert
					} else if (b == 1){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8


					//delete
					} else if (b == 2){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8


					} else {break}
					break

					index_update += 1
				}
				i +=1

				//u8
				for (let i = 0; i < new_item.u8.length; i++){
					while (true){
						if (new_item.u8[i][0][count] == undefined) {break}
						if (key[count] == undefined) {break}
						if (new_item.u8[i][0][count] != key[count]) {new_item.u8[i][1] = new_val}
						count += 1
					}
					pr("after while loop")
					pr("in between: ", new_item)
				}
				pr("finished: ", new_item)
				//str

			}
			pr(new_item.u8)
			render_update.ob.updatedItemCallback(new_item)
			break;

		case 11:
			break;

		case 12:
			break;

	}
	//const number_array = await message.data.arrayBuffer()
	//let arr = new Uint8Array(number_array)
}

function from_be_bytes(bytes){
	clone = Array.from(bytes)
	clone.reverse()

	let count = 0
	let num = 0
	for (i of clone) {
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

