import {Router} from '../../../src/index.js';
import './TodoApp.js';

const main = document.createElement('main');
document.body.appendChild(main);

const router = new Router();

const TODO_LIST_ID = 'd:TodoList1';

// Create TodoApp only once
let todoApp = null;

function showTodoApp() {
  if (!todoApp) {
    todoApp = document.createElement('todo-app-declarative');
    todoApp.setAttribute('about', TODO_LIST_ID);
    main.replaceChildren(todoApp);
  }
  // Filter is handled inside TodoApp via hashchange listener
}

router.add('#/', showTodoApp);
router.add('#/active', showTodoApp);
router.add('#/completed', showTodoApp);

