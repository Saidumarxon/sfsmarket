import fs from 'fs';

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

// Emulate DOM
class Element {
  constructor(id) {
    this.id = id;
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.options = [];
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }
  closest() { return this; }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  setAttribute() {}
  getAttribute() { return null; }
  addEventListener() {}
}

const elements = {};
global.document = {
  getElementById: (id) => {
    if (!elements[id]) elements[id] = new Element(id);
    return elements[id];
  },
  querySelector: (sel) => new Element(),
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
  body: new Element('body'),
  documentElement: new Element('html')
};
global.window = global;
global.window.location = { hash: '#categories', search: '?admin_preview=1', href: '' };
global.window.scrollTo = () => {};

// Load emirate-categories.js
const catCode = fs.readFileSync('d:/User/Documents/Emirate Co/emirate-categories.js', 'utf8');
eval(catCode);

console.log('Categories loaded from module:', global.window.emirateCategories.loadCategoriesData().length);
