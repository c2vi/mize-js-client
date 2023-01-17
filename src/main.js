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
    const num_u8 = new Uint8Array([1, 15, ...mize.encoder.encode(id), 47])
    mize.so.send(num_u8)
  }
}

mize.types = {}
mize.define_type = (type, definition) => {
  mize.types[type] = definition
}

document.addEventListener('DOMContentLoaded', () => {
  const so = new WebSocket('ws://' + location.host + '/==api==/socket')
  mize.so = so
  so.onopen = () => {
    so.onmessage = async (message) => {
      handle_message(new Uint8Array(await message.data.arrayBuffer()))
    }
    main(so)
  }

  /////////////// client overlay ////////////////
  const client_overlay = document.getElementById('client-overlay')
  client_overlay.childNodes[1].onclick = mz_click
  const overlay_menu = document.getElementById('overlay-menu')

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

async function main(so) {
  //get id
  let id = location.pathname.slice(1)
  if (location.pathname == '/') {
    id = '0'
  }
  if (id == NaN) {
    pr('id is NaN')
    id = '0'
  }
  mize.id_to_render = id

  mize.get_item(id, (item) => {
    const [render_id] = item.fields.filter(
      (field) => mize.decoder.decode(field.raw[0]) == '_render'
    )
    if (render_id) {
      render(render_id, item.id)
    } else {
      render('first', item.id)
    }
  })
}

async function render(render_id, item_id) {
  pr('render', item_id, render_id)
  //check if render is already in render_classes
  let render_class = mize.render_classes[render_id]
  if (render_class == undefined) {
    //get render
    //let res = await fetch('/==api==/render/' + render_id)
    //let script = await res.text()
    //eval(script)

    await import('/==api==/render/' + render_id)

    render_class = mize.new_render
    mize.render_classes[render_id] = { ob: render_class }

    customElements.define('mize-' + render_id, render_class)
  }

  const mize_element = document.getElementById('mize')
  mize_element.innerHTML = ''
  const item_element = document.createElement('mize-' + render_id)

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

class Item {
  constructor(id, raw) {
    //mize.Items.push(this)
    //raw: [["key1", "val1"]["key2", "val2"]]
    this.fields = []
    for (let field_raw of raw) {
      //don't add empty fields
      if (field_raw[0].length == 0) {
        continue
      }
      this.fields.push(new Field(field_raw))
    }
    this.id = id
  }

  clone() {
    let new_raw = []
    for (let field of this.fields) {
      new_raw.push(field.clone(field))
    }
    return new Item(this.id, new_raw)
  }

  get_parsed() {
    return generate_parsed_item(this)
  }

  update(parsed_item) {
    let raw_item = unparse(parsed_item)
    this.update_raw(raw_item)
  }

  change_val(key, new_val) {
    const new_item = this.clone()
    const [field] = new_item.fields.filter(
      (field) => mize.decoder.decode(field.raw[0]) == key
    )
    field.raw[1] = new Uint8Array(new_val)
    return new_item
  }

  update_raw(new_item) {
    let msg_tmp = []
    let num_of_updates = 0
    pr('new_item', new_item.get_parsed())
    pr('old', this.get_parsed())

    for (const new_field of new_item.fields) {
      let [old_field] = this.fields.filter((old_field) =>
        unit8_equal(old_field.raw[0], new_field.raw[0])
      )

      //in case there is a new key
      if (!old_field) {
        num_of_updates += 1
        msg_tmp = [
          ...msg_tmp,

          ...u32_to_be_bytes(new_field.raw[0].length),
          ...new_field.raw[0],

          //update len
          ...u32_to_be_bytes(9 + new_field.raw[1].length),

          //### update two: add everything
          //update cmd
          1,
          //start
          ...u32_to_be_bytes(0),
          //stop
          ...u32_to_be_bytes(new_field.raw[1].length),

          ...new_field.raw[1],
        ]
      } else {
        if (unit8_equal(new_field.raw[1], old_field.raw[1])) {
          continue
        }
        num_of_updates += 1

        msg_tmp = [
          ...msg_tmp,

          ...u32_to_be_bytes(new_field.raw[0].length),
          ...new_field.raw[0],

          //update len
          ...u32_to_be_bytes(9 + new_field.raw[1].length + 9),

          //### update one: delete everything
          //update cmd
          2,
          //start
          ...u32_to_be_bytes(0),
          //stop
          ...u32_to_be_bytes(old_field.raw[1].length),

          //### update two: add everything

          //update cmd
          1,
          //start
          ...u32_to_be_bytes(0),
          //stop
          ...u32_to_be_bytes(new_field.raw[1].length),

          ...new_field.raw[1],
        ]
      }
    }

    let msg = [
      1,
      8,
      ...mize.encoder.encode(this.id),
      47, // a "/"

      //num_of_updates
      ...u32_to_be_bytes(num_of_updates),

      //the rest of the msg
      ...msg_tmp,
    ]

    if (num_of_updates == 0) {
      pr('empty update msg')
      return
    }

    pr('actually sending update msg', msg)
    mize.so.send(new Uint8Array(msg))
  }
}

class Field {
  constructor(raw) {
    //raw: ["key", "val"]
    this.raw = raw
  }
  clone(field) {
    const key = new Uint8Array(field.raw[0])
    const val = new Uint8Array(field.raw[1])
    return [key, val]
  }

  get str() {
    return [
      String.fromCharCode.apply(null, this.raw[0]),
      String.fromCharCode(null, this.raw[1]),
    ]
  }

  get key() {
    return mize.decoder.decode(this.raw[0])
  }

  get val() {
    return mize.decoder.decode(this.raw[1])
  }

  get val_as_number() {
    return from_be_bytes(this.raw[1])
  }

  get val_raw() {
    return this.raw[1]
  }
}
async function handle_message(message) {
  const version = message[0]
  const cmd = message[1]

  switch (cmd) {
    case 1:
      break

    case 2:
      //get the id
      id_string = ''
      let ch = 0
      let index = 2
      while (ch != 47 && index < 2000) {
        ch = message[index]
        if (ch == 47) {
          break
        }
        id_string += String.fromCharCode(ch)
        index += 1
      }
      if (index >= 2000) {
        pr("there is no '/' after the id")
      }
      //skip the "/"
      index += 1

      let num_of_fields = from_be_bytes(message.slice(index, index + 4))
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
      let item = new Item(id_string, raw)
      mize.waiting_items[id_string].forEach((callback) => {
        if (typeof callback == 'function') {
          callback(item)
        } else {
          callback.getItemCallback(item)
        }
      })

      //add the item to the "cache"
      mize.items[id_string] = item

      break

    case 3:
      break

    case 4:
      break

    case 5:
      break

    case 6:
      break

    case 7:
      break

    case 8:
      break

    case 9:
      break

    case 10:
      pr('got update message')

      //get the id
      let id_update = ''
      let ch_update = 0
      let index_update = 2
      while (ch_update != 47 && index_update < 2000) {
        ch_update = message[index_update]
        if (ch_update == 47) {
          break
        }
        id_update += String.fromCharCode(ch_update)
        index_update += 1
      }
      if (index_update > 2000) {
        pr("there is no '/' after the id")
      }
      //skip the "/"
      index_update += 1

      let num_of_updates = from_be_bytes(
        message.slice(index_update, index_update + 4)
      )
      index_update += 4

      let i = 0

      const render_update = mize.renders[id_update]
      let new_item = mize.items[id_update].clone()
      while (i < num_of_updates) {
        //get key_len
        let key_len = from_be_bytes(
          message.slice(index_update, index_update + 4)
        )
        index_update += 4

        //get key
        let key = new Uint8Array(
          message.slice(index_update, index_update + key_len)
        )
        let key_str = mize.decoder.decode(key)
        let [field] = new_item.fields.filter((field) => field.key == key_str)

        // in case this field does not yet exist
        if (!field) {
          field = new Field([key, new Uint8Array()])
          new_item.fields.push(field)
        }

        index_update += key_len

        //get update_len
        let update_len = from_be_bytes(
          message.slice(index_update, index_update + 4)
        )
        index_update += 4

        //apply for key
        const index_update_here = index_update
        while (index_update - index_update_here < update_len) {
          let b = message[index_update]
          index_update += 1

          //replace
          if (b == 0) {
            const start = from_be_bytes(
              message.slice(index_update, index_update + 4)
            )
            const stop = from_be_bytes(
              message.slice(index_update + 4, index_update + 8)
            )
            index_update += 8

            let new_val = [
              ...field.raw[1].slice(0, start),
              ...message.slice(index_update, index_update + stop - start),
              ...field.raw[1].slice(start, -1),
            ]
            field.raw[1] = new Uint8Array(new_val)
            index_update += stop - start

            //insert
          } else if (b == 1) {
            const start = from_be_bytes(
              message.slice(index_update, index_update + 4)
            )
            const stop = from_be_bytes(
              message.slice(index_update + 4, index_update + 8)
            )
            index_update += 8

            let new_val = [
              ...field.raw[1].slice(0, start),
              ...message.slice(index_update, index_update + stop - start),
              ...field.raw[1].slice(start, -1),
            ]
            field.raw[1] = new Uint8Array(new_val)
            index_update += stop - start

            //delete
          } else if (b == 2) {
            const start = from_be_bytes(
              message.slice(index_update, index_update + 4)
            )
            const stop = from_be_bytes(
              message.slice(index_update + 4, index_update + 8)
            )
            index_update += 8

            let new_val = [
              ...field.raw[1].slice(0, start),
              ...field.raw[1].slice(stop, -1),
            ]
            field.raw[1] = new Uint8Array(new_val)
          } else {
            break
          }
        }
        i += 1
      }

      //remove empty fields
      new_item.fields = new_item.fields.filter(
        (field) => field.raw[1].length != 0
      )

      const update = {
        update_src: 'got_update_msg',
        now: new_item,
        before: mize.items[id_update],
      }

      //update the item in the "cache"
      mize.items[id_update] = new_item

      //set item on render
      mize.update_callbacks[id_update].forEach((callback) => {
        if (typeof callback == 'function') {
          callback(update)
        } else if (callback.updateCallback) {
          callback.item = new_item
          callback.updateCallback(update)
        } else {
          pr('has no updateCallback')
          render(callback.render_id, id_update)
        }
      })

      break

    case 11:
      break

    case 17:
      //error
      const json_string = mize.decoder.decode(message.slice(2))
      const err = JSON.parse(json_string)
      console.log('ERROR: ', err)
      break
  }
  //const number_array = await message.data.arrayBuffer()
  //let arr = new Uint8Array(number_array)
}

// hardcoded for testing
mize.types = {
  '!UNO!Game': [
    ['players', 'json_string_array'],
    ['card_in_middle', 'string'],
  ],
  '!UNO!Player': [
    ['cards_of_player', 'json_string_array'],
    ['cards_to_take', 'u_int'],
  ],
  '!UNO!Main': [['games', 'json_string_array']],
  'mize-main': [
    ['num_of_items', 'u_int'],
    ['next_free_id', 'u_int'],
  ],
}

function generate_parsed_item(item) {
  let object = {}
  let item_keyval = []

  for (let field of item.fields) {
    let key = mize.decoder.decode(field.raw[0])
    let val = mize.decoder.decode(field.raw[1])
    if (key === '_type') {
      item_keyval.push(key, val)

      break
    } else {
    }
  }

  for (let field of item.fields) {
    let key = mize.decoder.decode(field.raw[0])
    let val = mize.decoder.decode(field.raw[1])
    let mizetype_keyval = mize.types[item_keyval[1]]

    // handle undefined errors
    if (mizetype_keyval === undefined) {
      // handle '_commit' - so it doesn't get eaten by undefined
      if (key === '_commit') {
        let parse = from_be_bytes(field.raw[1])
        object[key] = parse
        // else just return string
      } else {
        let parse = val
        object[key] = parse
      }
      continue
    }

    let [compare] = mizetype_keyval.filter((ele) => ele[0] === key)

    if (key === '_commit') {
      let parse = from_be_bytes(field.raw[1])
      object[key] = parse
      // if undefined return as a string
    } else if (compare === undefined) {
      let parse = val
      object[key] = parse
      // if value is 'json_string_array'
    } else if (compare[1] === 'json_string_array') {
      let parse = JSON.parse(val)
      object[key] = parse
      // if value is 'string'
    } else if (compare[1] === 'string') {
      let parse = val
      object[key] = parse
      // if value is 'u_int'
    } else if (compare[1] === 'u_int') {
      let parse = from_be_bytes(field.raw[1])
      object[key] = parse
    } else {
    }
  }
  return object
}

//should return something of Class Item
function unparse(parsed_item) {
  let item = []

  let mize_type = mize.types[parsed_item._type]

  parsed_array = Object.entries(parsed_item) // item to array

  for (let fields of parsed_array) {
    let p_key = fields[0]
    let p_val = fields[1]

    if (mize_type === undefined) {
      if (p_key === '_commit') {
        //handle as u_int

        let arr_key = mize.encoder.encode(p_key)
        let arr_val = u64_to_be_bytes(p_val)
        pr('undefined', p_val)
        item.push([arr_key, arr_val])
      } else {
        let arr_key = mize.encoder.encode(p_key)
        let arr_val = mize.encoder.encode(p_val)
        item.push([arr_key, arr_val])
      }
      continue
    }

    let [compare] = mize_type.filter((ele) => ele[0] == p_key)

    if (p_key === '_commit') {
      let arr_key = mize.encoder.encode(p_key) // keys are always strings
      let arr_val = u64_to_be_bytes(p_val)
      item.push([arr_key, arr_val])
      continue
    }
    // error because: "if(compare[1] === undefined) {"
    if (compare === undefined) {
      let arr_key = mize.encoder.encode(p_key)
      let arr_val = mize.encoder.encode(p_val)
      item.push([arr_key, arr_val])
    } else if (compare[1] === 'json_string_array') {
      let arr_key = mize.encoder.encode(p_key)
      let arr_val = mize.encoder.encode(JSON.stringify(p_val)) // make a string and encode
      item.push([arr_key, arr_val])
    } else if (compare[1] === 'string') {
      let arr_key = mize.encoder.encode(p_key)
      let arr_val = mize.encoder.encode(p_val)
      item.push([arr_key, arr_val])
    } else if (compare[1] === 'u_int') {
      let arr_key = mize.encoder.encode(p_key)
      let arr_val = u64_to_be_bytes(p_val) // uint8
      item.push([arr_key, arr_val])
    } else {
    }
  }
  //mize.id_to_render is not going to work, when we support multiple renders per client
  let newitem = new Item(mize.id_to_render, item)

  pr('newitem commit', newitem.get_parsed()['_commit'])
  return newitem
}

function from_be_bytes(bytes) {
  let clone = Array.from(bytes)
  clone.reverse()

  let count = 0
  let num = 0
  for (i of clone) {
    num += i * 256 ** count
    count += 1
  }
  return num
}

function u64_to_be_bytes(num) {
  //let bytes = new Uint8Array([]);
  let bytes = []

  //compute digits
  while (true) {
    let digit = num % 256

    if (digit == 0) {
      break
    }

    bytes.push(digit)
    num = (num - digit) / 256
  }

  //fill array with 0s
  while (bytes.length < 8) {
    bytes.push(0)
  }

  return new Uint8Array(bytes.reverse())
}

function u32_to_be_bytes(num) {
  //let bytes = new Uint8Array([]);
  let bytes = []

  //compute digits
  while (true) {
    let digit = num % 256

    if (digit == 0) {
      break
    }

    bytes.push(digit)
    num = (num - digit) / 256
  }

  //fill array with 0s
  while (bytes.length < 4) {
    bytes.push(0)
  }

  return new Uint8Array(bytes.reverse())
}

function unit8_equal(buf1, buf2) {
  if (buf1.byteLength != buf2.byteLength) return false
  var dv1 = new Int8Array(buf1)
  var dv2 = new Int8Array(buf2)
  for (var i = 0; i != buf1.byteLength; i++) {
    if (dv1[i] != dv2[i]) {
      return false
    }
  }
  return true
}
