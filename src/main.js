
pr = console.log //because I don't want to type console.log() a thousend times when I'm debugging

/////////////// JSON UI ////////////////
jui = {}
jui.elements = []
jui.put = {}

jui.destroy = (jui_el) => {
	//TODO
}

jui.put.center = async (jui_el, height, width) => {
	let box = document.createElement("div")
	box.style.position = "relative"
	box.style.top = "50%"
	box.style.transform = "translate(-50%, -50%)"
	box.style.left = "50%"
	box.style.height = height + "px"
	box.style.width = width + "px"

	jui.render_webcomponent(box, jui_el)

	mize.element.appendChild(box)
}

jui.render_item = async (render_id, id, element) => {

	element.innerHTML = ""

	//get render
	let res = await fetch('/api/render/' + render_id)
	let text = await res.text()

	//if the render is a item with render-view
	if (res.headers.get("content-type") == "application/json"){

		ob = JSON.parse(text)

		if (!ob.id){
			ob.id = "@local/jui-view"
		}
		mize.items[ob.id] = ob

		ob.elements.forEach((el) => {
			el.id = ob.id + "/" +  el.id

			jui.elements.push(el)

			if (el.layout && el.layout.absolut){
				jui.absolut_placement(el)
			}
		})

	} else {
		eval(text)
		await jui.render_webcomponent(mize.element, {render_id})
	}

}

jui.absolut_placement = (el) => {
	html_el = document.createElement("div")
	html_el.style.position = "absolute"

	html_el.style.top = el.layout.top + "%"
	html_el.style.bottom = el.layout.bottom + "%"
	html_el.style.right = el.layout.right + "%"
	html_el.style.left = el.layout.left + "%"

	mize.element.innerHTML = ""
	mize.element.appendChild(html_el)

	jui.render_recursive(el, html_el)
}

jui.rendered_elements = []
jui.render_recursive = async (el, html_el, par_el) => {

	jui.rendered_elements.push(el)

	if (el.type == "v-split"){
		// TODO: needs better implementation
		let space = 100
		let last_hight = 0
		let last_el = undefined

		el.children.forEach((child) => {
			let inner_el = document.createElement("div")
			let last_el = inner_el

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

			let child_el = jui.elements.filter(el => el.id == "@local/jui-view/" + child.id)[0]
			html_el.appendChild(inner_el)

			jui.render_recursive(child_el, inner_el, el)
		})
		if (last_el) last_el.style.height = space + last_hight - 2 + "%"

	} else if (el.type == "h-split"){
		el.children.forEach((child) => {
			inner_el = document.createElement("div")
			inner_el.style.overflow = "hidden"
			inner_el.style.position = "relative"

			inner_el.style.height = "100%"
			inner_el.style.width = 100/el.children.length + "%"
			html_el.appendChild(inner_el)

			let child_el = jui.elements.filter(el => el.id == "@local/jui-view/" + child.id)[0]
			jui.render_recursive(child_el, inner_el, el)
		})

	} else if (el.type == "webcomponent"){
		await jui.render_webcomponent(html_el, el)

	} else {
		pr("JsonUI Element Type unhandeld:", el.type)
	}
}

jui.render_webcomponent = async (parent_el, jui_el) => {
		const render_id = jui_el["component_id"]
	pr("render_webcomponent", render_id)

		if (!customElements.get(render_id)) {
			// that custom element is not defined yet, so load it
			let res = await fetch('/api/render/' + render_id)
			text = await res.text()
			eval(text)
			await jui.render_webcomponent(parent_el, jui_el)
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

	const id = jui_el.data ? jui_el.data[0] : mize.id_to_render
	  item_element.jui = jui_el
	  item_element.render_id = render_id
	  item_element.id = id
	  item_element.item = mize.items[id]

	  //getItemCallback
	  // TODO: check if it has a getItemCallback or normal params..
	  item_element.getItemCallback(mize.items[id])
}


/////////////// The MIZE Object ////////////////
mize = {}
mize.renders = {}
mize.default_renders = {}
mize.items = {}
mize.waiting_items = {}
mize.update_callbacks = {}
mize.create_callbacks = []
mize.next_local_id_val = 0

mize.new_local_item = (main) => {
	let old = mize.next_local_id_val
	mize.next_local_id_val += 1

	const id = "@local/" + old
	const item = new Item({ ...main, __item__: id })
	mize.items[id] = item
	return item
}

mize.await_update = async (path_or_list, expected) => {
	let paths_and_expected = []
	if (path_or_list[0] && typeof path_or_list[0] == "string") {
		// path_or_list is a path, so there is only one path to await for
		paths_and_expected.push([path_or_list, expected])

	} else if (Array.isArray(path_or_list[0])) {
		//path_or_list is a list of [[path, expected], [path, expected], ....]
		paths_and_expected = path_or_list

	} else {
		pr("Arguments to mize.await_update are wrong")
		return
	}

	let promise_list = []
	for (let [path, expected] of paths_and_expected) {

		let promise = new Promise((resolve, reject) => {
			mize.add_update_callback((update) => {
				if (mize.deepEq(update.new_item.get_path(path), expected)) {
					resolve()
				}
			}, path[0])
		})
		promise_list.push(promise)
	}

	await Promise.all(promise_list)
}

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
      jui.render_item(render_id, id, mize.element)
    } else {
      jui.render_item("mize-mmejs", id, mize.element)
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
	  let msg = JSON.stringify({ cmd: "item.get-sub", id: String(id)})
    mize.so.send(msg)
  }
}

mize.create_item = async (item, callback) => {
	mize.so.send(JSON.stringify({ cmd: "item.create", item}))
	if (callback) {
		mize.add_create_callback(callback)
	} else {
		return new Promise((resolve, reject) => {
			mize.add_create_callback(resolve)
		})
	}
}

mize.add_create_callback = (callback) => {
	mize.create_callbacks.push(callback)
}

mize.get_delta = (old_item, new_item) => {

	if (typeof old_item.is_item == "function") {
		old_item = old_item.main
	}
	if (typeof new_item.is_item == "function") {
		new_item = new_item.main
	}

	let deltas = []
	let keys = Object.keys(old_item).concat(Object.keys(new_item))
	keys = keys.filter((item, pos) => keys.indexOf(item) === pos)

	//go through all keys in new_item and remove all that are the same in old_item
	keys.forEach((key) => {
		//pr("AT KEY:", key)

		//has to be with undefined and not !old_item.main[key], because if the value is false, it would match..... 
		if (old_item[key] === undefined) { 
			// if key is not found on old_item it must have been added
			//pr("added", key, old_item.main[key])
			deltas.push([[key], new_item[key]])

		} else if (new_item[key] === undefined) {
			// if key is not found on new_item it must have been deleted
			//pr("deleted")
			deltas.push([[key]])

		} else if (typeof new_item[key] == "object") {
			// if values are the same, or are objects call recursivly on inner objects
			//pr("object")
			inner_deltas = mize.get_delta(old_item[key], new_item[key])

			//if object is an Array, then convert the keys to numbers
			if (Array.isArray(new_item[key])) {
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

		} else if (old_item[key] != new_item[key]) {
			//values are different 
			//pr("different", key)
			deltas.push([[key], new_item[key]])

		} else {
			//values are the same
			//do nothing
		}
	})

	//pr("OLD:", old_item)
	//pr("NEW:", new_item)
	//pr("Delta:", JSON.stringify(deltas))
	return deltas
}

mize.add_update_callback = (callback, id) => {
	if (!mize.update_callbacks[id]) mize.update_callbacks[id] = []
	mize.update_callbacks[id].push(callback)
}

mize.rem_update_callback = (callback, id) => {
	mize.update_callbacks[id] = mize.update_callbacks[id].filter(cb => cb !== callback)
}

mize.path_changed_in_delta = (path, delta) => {

	//for every path in the delta
    for(var i = 0; i < delta.length; i++){
        let checker = false

        for(var j = 0; j < delta[i][0].length; j++){
            if(delta[i][0][j] === path[j]){
                checker = true
            } else {
                checker = false
                break;
            }
        }
        if (checker){
            return true
        }
    }
    return false
}

mize.update_item = (update) => {

	update.id = update.new_item.id

	//pr("UPDATE", update)
	//pr("OLD", mize.items[update.id].main)
	//pr("NEW", update.new_item.main)

	let old_item = mize.items[update.id]
	let new_item = update.new_item
	let delta = update.delta ? update.delta : mize.get_delta(old_item, new_item)

	//pr("OLD:", mize.items[update.id])
	//pr("NEW:", update.new_item)
	//pr("id:", update.id)

	//call all update_callbacks
	mize.update_callbacks[update.id].forEach((callback) => {

		if (callback.updateCallback){
			//the callback is render obj that has a updateCallback defined
			callback.item = update.new_item
			callback.updateCallback(update)

		} else if (callback.getItemCallback) {
			//the callback is a render obj without a updateCallback
			pr("rerendering component because it does not have a updateCallback")
			const par_el = callback.parentElement
			callback.parentElement.innerHTML = ""
			jui.render_webcomponent(par_el, callback.jui)

		} else if (typeof callback == "function") {
			//the callback is a function, so call it
			callback(update)

		} else if (Array.isArray(callback)) {
			//there is also a path. only call if the path changed
			const paths = delta.map(el => el[0])
			if (mize.path_in_delta(callback[1], delta)) {
				callback[0](update)
			}
		} else {
			pr("an Update Callback could not be handeld")
		}
	})

	//send update to server if update does not come from server
	if (update.src != "update_msg" && !update.id.startsWith("@local")){
		let msg = {
			cmd: "item.update-req",
			id: update.id,
			delta: delta
		}
		pr("SENDING:", JSON.stringify(msg))
		mize.so.send(JSON.stringify(msg))
	}

	//update the item in the cache
	//pr("setting item in cache", update.id, new_item.main)
	mize.items[update.id] = new_item
}

mize.types = {}
mize.define_type = (type, definition) => {
  mize.types[type] = definition
}

/////////////// END of the MIZE Object ////////////////


document.addEventListener('DOMContentLoaded', () => {
	mize.element = document.getElementById('mize')
	jui.root = mize.element
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
	pr("GOT", msg)

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
			const old_item = mize.items[msg.id]
			const new_item = old_item.clone().apply_delta(msg.delta)

			mize.update_item({new_item: new_item, update_src: "update_msg", delta: msg.delta})

		case "err":
			pr("ERROR: ", msg)
      	break;
		case "item.created-id":
			mize.create_callbacks.shift()(msg.id)
			break;

		default:
			pr("unhandeld msg cmd: ", msg.cmd)
			break;
	}
}

class Item{
	constructor(main){
		this.is_item = () => true
		this.main = main
		this.id = main.__item__

		mize.add_update_callback(update => {
			this.main = update.new_item.main
		}, this.id)
	}

	on_update(func){
		if (!mize.update_callbacks[this.id]) {
			mize.update_callbacks[this.id] = []
		}

		mize.update_callbacks.push(func)
	}

	update(func){
		let new_item = this.clone()
		let returned_val = func(new_item.main)

		//if it has a is_item, then the func returns a new item, instead of changing the passed value
		if (returned_val.is_item) new_item.main = returned_val
		mize.update_item({new_item, update_src: "from_component"})
	}

	get_path(path) {
		let item = this.clone().main
		for (let name of path) {
			if (item[name]){
				item = item[name]
			}
		}
		return item
	}

	apply_delta(delta){
		delta.forEach( change => {
			const path = change[0]
			const new_val = change[1]
			let old_val = this.main
			path.forEach( path_el => {
				if (!old_val[path_el]) {
					old_val[path_el] = {}
				}
				old_val = old_val[path_el]
			})
			old_val = new_val
		})
	}

	clone(){
		return new Item(mize.deepClone(this.main));
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

mize.deepEq = (x, y) => {
  return (x && y && typeof x === 'object' && typeof y === 'object') ?
    (Object.keys(x).length === Object.keys(y).length) &&
      Object.keys(x).reduce(function(isEqual, key) {
        return isEqual && mize.deepEq(x[key], y[key]);
      }, true) : (x === y);
}




