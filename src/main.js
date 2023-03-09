
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
		await json_ui.render_webcomponent(mize.element, render_id)
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

json_ui.render_recursive = async (el, html_el) => {
	pr("recursive: ", el)

	if (el.type == "v-split"){
		el.children.forEach((child) => {
			inner_el = document.createElement("div")
			inner_el.style.position = "relative"

			inner_el.style.width = "100%"
			inner_el.style.height = 100/el.children.length + "%"
			child_el = json_ui.elements.filter(el => el.id == "@local/render/" + child.id)[0]
			json_ui.render_recursive(child_el, inner_el)
		})

	} else if (el.type == "h-split"){
		el.children.forEach((child) => {
			inner_el = document.createElement("div")
			inner_el.style.position = "relative"

			inner_el.style.height = "100%"
			inner_el.style.width = 100/el.children.length + "%"
			json_ui.render_recursive(json_ui.elements.filter(el => el.id == child.id)[0], inner_el)
		})

	} else if (el.type == "webcomponent"){
		await json_ui.render_webcomponent(html_el, el["render-id"])

	} else {
		pr("Type unhandeld:", el.type)
	}
}

json_ui.render_webcomponent = async (parent_el, render_id) => {
	  const item_element = document.createElement(render_id)

		if (!customElements.get(render_id)) {
			await import('/api/render/' + render_id)
			pr(customElements.get(render_id))
		}

	  //if (!mize.update_callbacks[item_id]){mize.update_callbacks[item_id] = []}
	  mize.update_callbacks[mize.id_to_render] = []
	  mize.update_callbacks[mize.id_to_render].push(item_element)

	  mize.renders[mize.id_to_render] = {
		 render_id: render_id,
		 ob: item_element,
	  }
	  parent_el.appendChild(item_element)

	  item_element.render_id = render_id
	  item_element.id = mize.id_to_render
	  item_element.item = mize.items[mize.id_to_render]

	  //getItemCallback
	  // TODO: check if it has a getItemCallback or normal params..
	pr(item_element)
	  item_element.getItemCallback(mize.items[mize.id_to_render])
}


/////////////// The MIZE Object ////////////////
mize = {}
mize.renders = {}
mize.default_renders = {}
mize.items = {}
mize.waiting_items = {}
mize.update_callbacks = {}

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
	  let msg = JSON.stringify({cat: "item", cmd: "get", id: String(id)})
    mize.so.send(msg)
  }
}

mize.create_item = (item, callback) => {
	mize.so.send(JSON.stringify({cat: "item", cmd: "create", item}))
}

mize.update_item = (item, new_item) => {
	pr("doing update")
	pr("OLD", item)
	pr("NEW", new_item)

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

	switch (msg.cat) {
		case "item":
			handle_item_msg(msg) 
			break;

		case "error":
			pr("ERROR: ", msg)
      	break;

		default:
			pr("unhandeld msg cat: ", msg.cat)
			break;
	}
}

async function handle_item_msg(msg){

	switch (msg.cmd) {
		case "give":
			//add the item to the "cache"
			mize.items[msg.id] = msg.item


			//set item on render
			mize.waiting_items[msg.id].forEach((callback) => {
			  if (callback.getItemCallback) {
				 callback.getItemCallback("hellooooooooooooooooooo")
			  } else {
				 callback(msg.item)
			  }
			})

			break;

		case "update":
			pr("got updtae msg")

			const old_item = mize.items[msg.id]
			const new_item = old_item.clone().apply_delta(update.delta)

			const update = {
			  update_src: 'got_update_msg',
			  now: new_item,
			  before: old_item,
			}

			//update the item in the "cache"
			mize.items[msg.id] = new_item

			//set item on render
			mize.update_callbacks[msg.id].forEach((callback) => {

				if (callback.updateCallback){
					//the callback is render obj that has a updateCallback defined
					callback.item = new_item
					callback.updateCallback(update)

				} else if (callback.getItemCallback) {
					//the callback is a render obj without a updateCallback
					render(callback.render_id, msg.id)

				} else {
					//the callback is a function, so call it
					callback(update)
				}
			})
			break;

		default:
			pr("unhandeld msg", msg.msg)
			break;
	}
}

