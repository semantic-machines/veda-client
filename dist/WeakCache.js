export default class a{constructor(){this.storage=new Map}get(e){if(this.storage.has(e)){const s=this.storage.get(e).deref();if(s)return s;this.storage.delete(e)}}set(e,t){this.storage.set(e,new WeakRef(t))}delete(e){this.storage.delete(e)}}