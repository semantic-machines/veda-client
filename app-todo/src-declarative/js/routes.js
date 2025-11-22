import {Router} from '../../../src/index.js';
import './TodoApp.js';

const main = document.createElement('main');
document.body.appendChild(main);

const router = new Router();

const TODO_LIST_ID = 'd:TodoList1';

function showTodoApp() {
  const component = document.createElement('todo-app-declarative');
  component.setAttribute('about', TODO_LIST_ID);
  main.replaceChildren(component);
}

router.add('#/', showTodoApp);
router.add('#/active', showTodoApp);
router.add('#/completed', showTodoApp);

