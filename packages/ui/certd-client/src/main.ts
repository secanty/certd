import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import Antd from "ant-design-vue";
import "./style/common.less";
import i18n from "./i18n";
import store from "./store";
import components from "./components";
import plugin from "./plugin/";

// @ts-ignore
const app = createApp(App);
// 尽量
app.use(Antd);
app.use(router);
app.use(i18n);
app.use(store);
app.use(components);
app.use(plugin, { i18n });
app.mount("#app");
