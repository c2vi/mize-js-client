//some global stuff
pr = console.log //because I don't want to type console.log() a thousend times when I'm debugging
mize = {}
//mize.Items = []
mize.encoder = new TextEncoder()
mize.decoder = new TextDecoder()
mize.defineRender = (render_class, for_types) => {
  mize.new_render = render_class
}
mize.render_classes = {}
mize.renders = {}
mize.default_renders = {}
mize.items = {}
mize.waiting_items = {}
mize.update_callbacks = {}
mize.render_item = (id, pushHistory = true) => {
	if (pushHistory){
		pr("pushing", id)
  		window.history.pushState({id: id}, "", id);
	}
  mize.id_to_render = id

  mize.get_item(id, (item) => {
    const [render_id] = Object.keys(item).filter(
      field => field == "render"
    )
    if (render_id) {
      render(render_id, id)
    } else {
      render("mize-mmejs-foldermain", id)
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

document.addEventListener('DOMContentLoaded', () => {
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

  /////////////// client overlay ////////////////
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

async function render(render_id, item_id) {
  //check if render is already in render_classes
  let render_class = mize.render_classes[render_id]
  if (render_class == undefined) {
    //get render
    //let res = await fetch('/api/render/' + render_id)
    //let script = await res.text()
    //eval(script)

	  pr("HEREEEEEEEEEE")
    await import('/api/render/' + render_id)

    //render_class = mize.new_render
    //mize.render_classes[render_id] = { ob: render_class }

	  //customElements.define(render_id, render_class)
  }

  const mize_element = document.getElementById('mize')
  mize_element.innerHTML = ''
  const item_element = document.createElement(render_id)
	pr("item ele", item_element.name)

  //if (!mize.update_callbacks[item_id]){mize.update_callbacks[item_id] = []}
  mize.update_callbacks[item_id] = []
  mize.update_callbacks[item_id].push(item_element)

  mize.renders[mize.id_to_render] = {
    render_id: render_id,
    ob: item_element,
  }
  mize_element.appendChild(item_element)

  item_element.render_id = render_id
  item_element.id = item_id
  item_element.item = mize.items[item_id]

  //getItemCallback
  item_element.getItemCallback(mize.items[item_id])
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

