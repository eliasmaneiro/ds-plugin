// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {
  height: 600,
  width: 600
});

const pages:{id: String, name: String}[] = [];
for (const page of figma.root.children) {
  pages.push({
    id: page.id,
    name: page.name
  })    
}
figma.ui.postMessage({
  pages
});

interface MainComponent {
  id: String,
  name: String,
  svg: String
}

const mainComponentIDS:MainComponent[] = [];

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage =  async (data: {type: string, msg: string, endpoint: string, pages: String[]}) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.

  // load all pages
  figma.loadAllPagesAsync();
  const excludeFromChildAndNode = ["header-page"];
  const excludeFromChildAndNodeTypes = ["VECTOR"];
  async function traverse(node: any) {
    if (node && "children" in node) {
      let componentCount = 0;
      const childrensToEvaluate = node.children.filter((k:any) => k.type && !excludeFromChildAndNodeTypes.includes(k.type));
      for (const child of childrensToEvaluate) {
        // se llama de manera recursiva hasta comprobar todos los niveles y armar el componente
        if(!excludeFromChildAndNode.includes(child.name) && !excludeFromChildAndNode.includes(node.name) && !excludeFromChildAndNodeTypes.includes(child.type)) {
          const dataChild:any = {};
          const keys = Object.keys(Object.getPrototypeOf(child));
          for (let i = 0; i < keys.length; i++) {
            const e = keys[i];
            if(e == 'parent') {
              dataChild[e] = child[e].id;
            } else if (e !== 'children') {
              try {
                if(e == 'type' && child[e] == 'INSTANCE') {
                  if(child.children && child.children.length && !child.children.find((k: any) => k.type && !excludeFromChildAndNodeTypes.includes(k.type))) {
                    console.log('existe al menos uno que es vector', child.children);
                    const mainComponent = await child.getMainComponentAsync();
                    const mainComp = mainComponentIDS.find((j) => j.id == mainComponent.id && mainComponent.name == j.name);
                    if(mainComp) {
                      dataChild["svgString"] = mainComp.svg;
                    } else {
                      const newComp:MainComponent = {
                        id: mainComponent.id,
                        name: mainComponent.name,
                        svg: await mainComponent.exportAsync({ format: 'SVG_STRING'})
                      }
                      dataChild["svgString"] = newComp.svg;
                      mainComponentIDS.push(newComp);
                    }

                  }
                }
                dataChild[e] = child[e];
              } catch (error) {
                console.log(`field error ${e}`)
              }
            }
          }
        dataChild.id = child.id;
        await fetch(`${data.endpoint}/component`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            data: dataChild
          })
        })
        if(node.type == 'SECTION') {
          componentCount++;
          figma.ui.postMessage({
            component: {
              moduleName: 'Componente',
              name: `${node.name} - ${child.name}`,
              componentChildrens: node.children.length,
              componentCount
            }
          });
        }
        } // end condicional exclude array component
          await traverse(child);
      } // end childrens iteration
    }
  }
  if(data.msg == "isAuthenticateTrySyncBtn2") {
    return "retornndo mensaje de postMessage"
  }
  if (data.msg == "isAuthenticate") {

    // sync file

    figma.ui.postMessage({
      moduleName: 'File',
      pageName: undefined,
      actuallyCount: 1,
      totalCount: 1,
    })
    
    await fetch(`${data.endpoint}/file`, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        file: {
          id: figma.root.id,
          documentColorProfile: figma.root.documentColorProfile,
          isAsset: figma.root.isAsset,
          name: figma.root.name,
          parent: figma.root.parent?.id,
          removed: figma.root.removed,
          type: figma.root.type
        }
      })
    })
    
    // sync variables
    
    const variables = await figma.variables.getLocalVariablesAsync();
    figma.ui.postMessage({
      moduleName: 'Variables',
      pageName: undefined,
      actuallyCount: 1,
      totalCount: variables.length,
    })
    const variablesParsed = variables.map((e) => {
      return {
        id: e.id,
        description: e.description,
        key: e.key,
        name: e.name,
        remote: e.remote,
        resolvedType: e.resolvedType,
        scoped: e.scopes,
        valuesByMode: e.valuesByMode,
        variableCollectionId: e.variableCollectionId
      }
    })
    figma.ui.postMessage({
      moduleName: 'Variables',
      pageName: undefined,
      actuallyCount: variables.length,
      totalCount: variables.length,
    })
    await fetch(`${data.endpoint}/variable`, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        variables: variablesParsed,
        file: figma.root.id
      })
    })

    // sync page

    figma.ui.postMessage({
      moduleName: 'Páginas',
      pageName: undefined,
      actuallyCount: 1,
      totalCount: figma.root.children.length,
    })

    interface pageInterface {
      id: String,
      isAsset: Boolean,
      name: String,
      parent: String | undefined,
      removed: Boolean,
      backgrounds: readonly Paint[],
      exportSettings: readonly ExportSettings[],
      flowStartingPoints: readonly { nodeId: string; name: string; }[],
      prototypeBackgrounds: readonly Paint[],
      prototypeStartNode: any,
      selectedTextRange: any,
      guides: readonly Guide[],
      selection: readonly SceneNode[],
      file: String
    };
    let pageCount = 1;
    for (const page of figma.root.children) {
      if(data.pages.includes(page.id)) {
        // await page.loadAsync();
        figma.ui.postMessage({
          moduleName: 'Páginas',
          pageName: page.name,
          actuallyCount: pageCount++,
          totalCount: data.pages.length,
        })
        const pageToSave:pageInterface = {
          id: page.id,
          isAsset: page.isAsset,
          name: page.name,
          parent: page.parent?.id,
          removed: page.removed,
          backgrounds: page.backgrounds,
          exportSettings: page.exportSettings,
          flowStartingPoints: page.flowStartingPoints,
          prototypeBackgrounds: page.prototypeBackgrounds,
          prototypeStartNode: page.prototypeStartNode,
          selectedTextRange: page.selectedTextRange,
          guides: page.guides,
          selection: page.selection,
          file: figma.root.id
        };
        await fetch(`${data.endpoint}/page`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            page:pageToSave
          })
        })
        await traverse(page);
      }
    }
  }// end isAuthenticate
  console.log('sync finished');
  if(data.msg == 'cancel') {
    figma.closePlugin();
  }
  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
