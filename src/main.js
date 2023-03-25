
pr = console.log //because I don't want to type console.log() a thousend times when I'm debugging

/////////////// JSON UI ////////////////
json_ui = {}
json_ui.elements = []
json_ui.render_item = async (render_id, id, element) => {

	element.innerHTML = ""

	//get render
	let res = await fetch('/api/render/' + render_id)

	//if the render is a item with render-view
	if (res.headers.get("content-type") == "application/json"){

		ob = JSON.parse(await res.text())

		if (!ob.id){
			ob.id = "@local/render"
		}

		ob.elements.forEach((el) => {
			el.id = ob.id + "/" +  el.id

			json_ui.elements.push(el)

			if (el.layout && el.layout.absolut){
				json_ui.absolut_placement(el)
			}
		})

	} else {
		eval(await res.text())
		await json_ui.render_webcomponent(mize.element, {render_id})
	}

}

json_ui.absolut_placement = (el) => {
	html_el = document.createElement("div")
	html_el.style.position = "absolute"

	html_el.style.top = el.layout.top + "%"
	html_el.style.bottom = el.layout.bottom + "%"
	html_el.style.right = el.layout.right + "%"
	html_el.style.left = el.layout.left + "%"

	mize.element.innerHTML = ""
	mize.element.appendChild(html_el)

	json_ui.render_recursive(el, html_el)
}

json_ui.rendered_elements = []
json_ui.render_recursive = async (el, html_el, par_el) => {
	//pr("RECURSIVE EL: ", el)

	json_ui.rendered_elements.push(el)

	if (el.type == "v-split"){
		// TODO: needs better implementation
		space = 100
		last_hight = 0
		last_el = undefined

		el.children.forEach((child) => {
			inner_el = document.createElement("div")
			last_el = inner_el

			inner_el.style.overflow = "hidden"
			inner_el.style.position = "relative"

			inner_el.style.width = "100%"

			if (child.layout && child.layout["prefered-size"]){
				inner_el.style.height = child.layout["prefered-size"] + "%"
				space = space - child.layout["prefered-size"]
				last_hight = child.layout["prefered-size"]

			} else {
				inner_el.style.height = 100/el.children.length + "%"
				space = space - 100/el.children.length
				last_hight = 100/el.children.length
			}

			child_el = json_ui.elements.filter(el => el.id == "@local/render/" + child.id)[0]
			html_el.appendChild(inner_el)

			json_ui.render_recursive(child_el, inner_el, el)
		})
		last_el.style.height = space + last_hight - 2 + "%"

	} else if (el.type == "h-split"){
		el.children.forEach((child) => {
			inner_el = document.createElement("div")
			inner_el.style.overflow = "hidden"
			inner_el.style.position = "relative"

			inner_el.style.height = "100%"
			inner_el.style.width = 100/el.children.length + "%"
			html_el.appendChild(inner_el)

			json_ui.render_recursive(child_el, inner_el, el)
		})

	} else if (el.type == "webcomponent"){
		await json_ui.render_webcomponent(html_el, el)

	} else {
		pr("JsonUI Element Type unhandeld:", el.type)
	}
}

json_ui.render_webcomponent = async (parent_el, json_ui_el) => {
		const render_id = json_ui_el["render-id"]

		if (!customElements.get(render_id)) {
			// that custom element is not defined yet, so load it
			let res = await fetch('/api/render/' + render_id)
			text = await res.text()
			eval(text)
			await json_ui.render_webcomponent(parent_el, json_ui_el)
			return
		}

	  const item_element = document.createElement(render_id)

	  //if (!mize.update_callbacks[item_id]){mize.update_callbacks[item_id] = []}
	  mize.update_callbacks[mize.id_to_render] = []
	  mize.update_callbacks[mize.id_to_render].push(item_element)

	  //mize.renders[mize.id_to_render] = {
		 //render_id: render_id,
		 //ob: item_element,
	  //}

	  parent_el.appendChild(item_element)

	  item_element.json_ui_el = json_ui_el
	  item_element.render_id = render_id
	  item_element.id = mize.id_to_render
	  item_element.item = mize.items[mize.id_to_render]

	  //getItemCallback
	  // TODO: check if it has a getItemCallback or normal params..
	  item_element.getItemCallback(mize.items[mize.id_to_render])
}


/////////////// The MIZE Object ////////////////
mize = {}
mize.renders = {}
mize.default_renders = {}
mize.items = {}
mize.waiting_items = {}
mize.update_callbacks = {}

//checks if there is a "render" key set on the item and gets the item
mize.render_item = (id, pushHistory = true) => {
	if (pushHistory){
  		window.history.pushState({id: id}, "", id);
	}
  mize.id_to_render = id

  mize.get_item(id, (item) => {
    const [render_id] = Object.keys(item).filter(
      field => field == "render"
    )

    if (render_id) {
      json_ui.render_item(render_id, id, mize.element)
    } else {
      json_ui.render_item("mize-mmejs", id, mize.element)
    }

  })
}

mize.change_render = async (render_id) => {
  //as long as we can only render one item at a time, this is fine
  render(render_id, mize.id_to_render)
  mize.update_callbacks[mize.id_to_render] = []
}

mize.get_item = (id, callback) => {
  //item already gotten
  if (mize.items[id]) {
    callback(mize.items[id])

    //item is already in the process of being gotten
  } else if (mize.waiting_items[id]) {
    mize.waiting_items[id].push(callback)

    //start the process of getting the item
  } else {
    mize.waiting_items[id] = [callback]

    //send msg to get the item
	  let msg = JSON.stringify({ cmd: "item.get", id: String(id)})
    mize.so.send(msg)
  }
}

mize.create_item = (item, callback) => {
	mize.so.send(JSON.stringify({ cmd: "item.create", item}))
}

mize.get_delta = (old_item, new_item) => {
	//pr("OLD:", old_item)
	//pr("NEW:", new_item)
	let deltas = []
	let keys = Object.keys(old_item.data).concat(Object.keys(new_item.data))
	keys = keys.filter((item, pos) => keys.indexOf(item) === pos)

	//go through all keys in new_item and remove all that are the same in old_item
	keys.forEach((key) => {
		//pr("AT KEY:", key)

		if (!old_item.data[key]) {
			// if key is not found on old_item it must have been added
			//pr("added")
			deltas.push([[key], new_item.data[key]])

		} else if (!new_item.data[key]) {
			// if key is not found on new_item it must have been deleted
			//pr("deleted")
			deltas.push([[key]])

		} else if (typeof new_item.data[key] == "object") {
			// if values are the same, or are objects call recursivly on inner objects
			//pr("object")
			inner_deltas = mize.get_delta(old_item.data[key], new_item.data[key])

			//if object is an Array, then convert the keys to numbers
			if (Array.isArray(new_item.data[key])) {
				inner_deltas.forEach(change => {
					let path = change[0]
					path[0] = Number(path[0])
				})
			}

			//extend the path
			inner_deltas.forEach((change) => {
				// change: [path, new_obj], path is an array of keys
				let path = change[0]
				path.unshift(key)
			})

			//and add to deltas
			deltas.push(...inner_deltas)

		} else if (o.datald_item[key] !== new_item.data[key]) {
			//values are different 
			//pr("different")
			deltas.push([[key], new_item.data[key]])

		} else {
			//values are the same
			//do nothing
		}
	})

	return deltas
}

mize.update_item = (update) => {

	update.id = update.new_item.id

	old_item = mize.items[update.id]
	new_item = update.new_item

	pr("OLD:", mize.items[update.id])
	pr("NEW:", update.new_item)
	pr("id:", update.id)

	//call all update_callbacks
	mize.update_callbacks[update.id].forEach((callback) => {

		if (callback.updateCallback){
			//the callback is render obj that has a updateCallback defined
			callback.item = update.new_item
			callback.updateCallback(update)

		} else if (callback.getItemCallback) {
			//the callback is a render obj without a updateCallback
			pr("rerendering component because it does not have a updateCallback")
			callback.parentElement.innerHTML = ""
			pr(callback.parentElement)
			json_ui.render_webcomponent(callback.parentElement, callback.json_ui_el)

		} else if (typeof callback == "function") {
			//the callback is a function, so call it
			callback(update)

		} else {
			pr("an Update Callback could not be handeld")
		}
	})

	//send update to server if update does not come from server
	if (update.src != "got_update_msg"){
		let msg = {
			cmd: "item.update-req",
			id: update.id,
			delta: mize.get_delta(old_item, new_item),
		}
		pr("SENDING:", JSON.stringify(msg))
		mize.so.send(JSON.stringify(msg))
	}

	//update the item in the cache
	mize.items[update.id] = new_item
}

mize.types = {}
mize.define_type = (type, definition) => {
  mize.types[type] = definition
}

/////////////// END of the MIZE Object ////////////////


document.addEventListener('DOMContentLoaded', () => {
	mize.element = document.getElementById('mize')
	json_ui.root = mize.element
  const so = new WebSocket('ws://' + location.host + '/api/socket')
  mize.so = so
  so.onopen = () => {
    so.onmessage = async (message) => {
      handle_message(message)
    }
	  main()
  }

	addEventListener("popstate", () => {
		main()
	})

/////////////// CLIENT OVERLAY ////////////////
  const client_overlay = document.getElementById('client-overlay')
	client_overlay.style.zIndex = 999999999
	client_overlay.childNodes[1].style.zIndex = 999999999
  client_overlay.childNodes[1].onclick = mz_click
	const overlay_menu = document.getElementById("overlay-menu")
	overlay_menu.style.zIndex = 999999998

  for (const el of overlay_menu.childNodes[3].childNodes) {
    if (el.tagName == 'BUTTON') {
      el.onclick = () => {
        mize.change_render(el.id)
        client_overlay.childNodes[3].style.display = 'none'
      }
    }
  }

  client_overlay.addEventListener('mouseenter', (e) => {
    e.target.childNodes[1].style.display = 'flex'
  })

  client_overlay.addEventListener('mouseleave', (e) => {
    e.target.childNodes[1].style.display = 'none'
  })

  function mz_click() {
    let display = client_overlay.childNodes[3].style.display
    if (display == 'none' || display == '') {
      client_overlay.childNodes[3].style.display = 'block'
    } else {
      client_overlay.childNodes[3].style.display = 'none'
    }
  }
})

async function main() {
  //get id
  let id = location.pathname.slice(1)
  if (location.pathname == '/') {
    id = '0'
  }
  if (id == NaN) {
    pr('id is NaN')
    id = '0'
  }
		mize.render_item(id, false)
}


async function handle_message(message) {
	const msg = JSON.parse(message.data)

	switch (msg.cmd) {
		case "item.give":
			//add the item to the "cache"
			const item = new Item(msg.item)
			mize.items[msg.id] = item
			mize.update_callbacks[item.id] = []

			//set item on render
			mize.waiting_items[msg.id].forEach((callback) => {
			  if (callback.getItemCallback) {
				 callback.getItemCallback(item)
			  } else {
				 callback(item)
			  }
			})

			break;

		case "item.update":

			pr("got updtae msg")

			const old_item = mize.items[msg.id]
			const new_item = old_item.clone().apply_delta(msg.delta)

			mize.update_item({new_item: new_item, update_src: "got_update_msg"})

		case "err":
			pr("ERROR: ", msg)
      	break;

		default:
			pr("unhandeld msg cmd: ", msg.cmd)
			break;
	}
}

class Item{
	constructor(data){
		this.data = data
		this.id = data.__item__
		pr("constructor", data.__item__)
	}

	on_update(func){
		if (!mize.update_callbacks[this.id]) {
			mize.update_callbacks[this.id] = []
		}

		mize.update_callbacks.push(func)
	}

	update(func){
		let new_item = func(this.clone())
		pr("update", new_item)
		mize.update_item({new_item, update_src: "from component"})
	}

	apply_delta(delta){
		pr("applying delta")
	}

	clone(){
		return new Item(mize.deepClone(this.data));
	}

}

mize.deepClone = (ob) => {
		if (ob === null) return null;
		let clone = Object.assign({}, ob);
		Object.keys(clone).forEach(
			key =>
			(clone[key] =
				typeof ob[key] === 'object' ? mize.deepClone(ob[key]) : ob[key])
		);
		if (Array.isArray(ob)) {
			clone.length = ob.length;
			return Array.from(clone);
		}
		return clone;
	}




