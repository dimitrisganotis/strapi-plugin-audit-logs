import React from "react";
import { Switch, Route } from "react-router-dom";
import { NoContent } from "@strapi/helper-plugin";
import pluginId from "../../pluginId";
import HomePage from "../HomePage";

const App = () => {
  return (
    <div>
      <Switch>
        <Route path={`/plugins/${pluginId}`} component={HomePage} exact />
        <Route component={() => <NoContent />} />
      </Switch>
    </div>
  );
};

export default App;
