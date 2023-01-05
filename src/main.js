
//some global stuff
pr = console.log
mize = {}
mize.encoder = new TextEncoder()
mize.decoder = new TextDecoder()
encoder = new TextEncoder()

let render_classes = []
let renders= []

document.addEventListener("DOMContentLoaded", () =>{
	const so = new WebSocket("ws://" + location.host + "/$api/socket")
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
	//let id = parseInt(location.pathname.slice(1))
	let id = location.pathname.slice(1)
	if (location.pathname == "/") {id = "0"}
	if (id == NaN) {pr("id is NaN"); id = "0"}
	pr("id: ", id);

	customElements.define("mize-first", first);
	const mize_element = document.getElementById("mize")
	const item_element = document.createElement("mize-first");
	renders.push({
		render_id: "first",
		ob: item_element,
		item_id: id,
	})
	item_element.so = so
	mize_element.appendChild(item_element)

	let num_u8 = new Uint8Array([1,15])
	num_u8 = new Uint8Array([...num_u8, ...mize.encoder.encode(id), 47])
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

			//get the id
			id_string = ""
			let ch = 0;
			let index = 2
			while (ch != 47 && index < 2000) {
				ch = message[index]
				if (ch == 47){break}
				id_string += String.fromCharCode(ch)
				index += 1
			}
			if (index >= 2000) {pr("there is no '/' after the id")}
			//skip the "/"
			index += 1


			let num_of_fields = from_be_bytes(message.slice(index, index +4))
			index += 4

			let raw = []

			let fields = 0
			while (fields < num_of_fields && fields < 10000) {
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
			let [render] = renders.filter( (render) => render.item_id == id_string)
			render.ob.getItemCallback(new Item(id_string, raw))

			
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
			pr("got update message")

			//get the id
			id_update = ""
			let ch_update = 0;
			let index_update = 2
			while (ch_update != 47 && index_update < 2000) {
				ch_update = message[index_update]
				if (ch_update == 47){break}
				id_update += String.fromCharCode(ch_update)
				index_update += 1
			}
			if (index_update > 2000) {pr("there is no '/' after the id")}
			//skip the "/"
			index_update += 1


			let num_of_updates = from_be_bytes(message.slice(index_update, index_update +4))
			index_update += 4

			let i = 0

			const [render_update] = renders.filter( render => render.item_id == id_update)
			let item = render_update.ob.item
			while (i < num_of_updates) {

				//get key_len
				let key_len = from_be_bytes(message.slice(index_update, index_update + 4))
				index_update += 4

				//get key
				let key = new Uint8Array(message.slice(index_update, index_update + key_len))
				let key_str = mize.decoder.decode(key)
				const [field] = item.fields.filter(field => field.key == key_str)
				index_update += key_len

				//get update_len
				let update_len = from_be_bytes(message.slice(index_update, index_update + 4))
				index_update += 4

				
				//apply for key
				const index_update_here = index_update
				while (index_update - index_update_here < update_len) {
					let b = message[index_update]
					index_update += 1


					//replace
					if (b == 0){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8

						let new_val = [
							...field.raw[1].slice(0, start),
							...message.slice(index_update, index_update + stop-start),
							...field.raw[1].slice(start, -1)
						]
						field.raw[1] = new Uint8Array(new_val)
						index_update += stop-start


					//insert
					} else if (b == 1){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8

						let new_val = [
							...field.raw[1].slice(0, start),
							...message.slice(index_update, index_update + stop-start),
							...field.raw[1].slice(start, -1)
						]
						field.raw[1] = new Uint8Array(new_val)
						index_update += stop-start


					//delete
					} else if (b == 2){
						const start = from_be_bytes(message.slice(index_update, index_update + 4))
						const stop = from_be_bytes(message.slice(index_update +4, index_update + 8))
						index_update += 8

						let new_val = [
							...field.raw[1].slice(0, start),
							...field.raw[1].slice(stop, -1)
						]
						field.raw[1] = new Uint8Array(new_val)

					} else {break}

				}
				i +=1
			}
			render_update.ob.getItemCallback(render_update.ob.item)
			break;

		case 11:
			break;

		case 17:
			//error
			const json_string = mize.decoder.decode(message.slice(2))
			const err = JSON.parse(json_string)
			console.log("ERROR: ", err)
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

