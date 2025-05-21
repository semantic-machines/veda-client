import {Router, Backend, Subscription, Model} from '../../../src/index.js';

(async () => {
  await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
  Subscription.init();

  await import('./routes.js');

  const router = new Router();
  router.go(location.hash || '#/app/d:TestApplication');

  const userModel = new Model(Backend.user_uri);
  await userModel.load();
  console.log(userModel);
  const appointment = userModel['v-s:hasAppointment'][0];
  await appointment.load();
  console.log(appointment);
})();
