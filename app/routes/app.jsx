import { Outlet } from "react-router";

import { AppProvider } from "@shopify/polaris";

import "@shopify/polaris/build/esm/styles.css";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {

  await authenticate.admin(request);

  return {};
};

export default function App() {

  return (

    <AppProvider i18n={{}}>

      <Outlet />

    </AppProvider>
  );
}