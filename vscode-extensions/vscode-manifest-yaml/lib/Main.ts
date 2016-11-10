'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as VSCode from 'vscode';
import {testUtil} from 'commons-vscode';
import * as Path from 'path';
import * as FS from 'fs';
import PortFinder = require('portfinder');
import * as Net from 'net';
import * as ChildProcess from 'child_process';
import {LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, StreamInfo} from 'vscode-languageclient';
import {TextDocument, OutputChannel} from 'vscode';

PortFinder.basePort = 45556;

var DEBUG = false;
const DEBUG_ARG = '-agentlib:jdwp=transport=dt_socket,server=y,address=8000,suspend=y';
    //If DEBUG is falsy then
    //   we launch from the 'fat jar' (which has to be built by running mvn package)
    //if DEBUG is truthy then
    //   - we launch the Java project directly from the classes folder produced by Eclipse JDT compiler
    //   - we add DEBUG_ARG to the launch so that remote debugger can attach on port 8000

var log_output : OutputChannel = null;

function log(msg : string) {
    if (log_output) {
        log_output.append(msg +"\n");
    }
}

function error(msg : string) {
    if (log_output) {
        log_output.append("ERR: "+msg+"\n");
    }
}

/** Called when extension is activated */
export function activate(context: VSCode.ExtensionContext) {
    VSCode.window.showInformationMessage(testUtil());
    VSCode.window.showInformationMessage("Activating manifest.yml extension");
    log_output = VSCode.window.createOutputChannel("manifest-yml-debug-log");
    log("Activating manifest.yml extension");
    let javaExecutablePath = findJavaExecutable('java');
    
    if (javaExecutablePath == null) {
        VSCode.window.showErrorMessage("Couldn't locate java in $JAVA_HOME or $PATH");
        return;
    }
    log("Found java exe: "+javaExecutablePath);
        
    isJava8(javaExecutablePath).then(eight => {
        if (!eight) {
            VSCode.window.showErrorMessage('Java language support requires Java 8 (using ' + javaExecutablePath + ')');
            return;
        }
        log("isJavaEight => true");
                    
        // Options to control the language client
        let clientOptions: LanguageClientOptions = {
            
            // HACK!!! documentSelector only takes string|string[] where string is language id, but DocumentFilter object is passed instead
            // Reasons:
            // 1. documentSelector is just passed over to functions like #registerHoverProvider(documentSelector, ...) that take documentSelector
            // parameter in string | DocumentFilter | string[] | DocumentFilter[] format
            // 2. Combination of non string|string[] documentSelector parameter and synchronize.textDocumentFilter function makes doc synchronization
            // events pass on to Language Server only for documents for which function passed via textDocumentFilter property return true

            // TODO: Remove <any> cast ones https://github.com/Microsoft/vscode-languageserver-node/issues/9 is resolved
            documentSelector: [ <any> {language: 'yaml', pattern: '**/manifest*.yml'}],
            synchronize: {
                // Synchronize the setting section to the server:
                configurationSection: 'languageServerExample',
                // Notify the server about file changes to 'javaconfig.json' files contain in the workspace
                fileEvents: [
                    //What's this for? Don't think it does anything useful for this example:
                    VSCode.workspace.createFileSystemWatcher('**/.clientrc')
                ],

                // TODO: Remove textDocumentFilter property ones https://github.com/Microsoft/vscode-languageserver-node/issues/9 is resolved
                textDocumentFilter: function(textDocument : TextDocument) : boolean {
                    let result : boolean =  /^(.*\/)?manifest[^\s\\/]*.yml$/i.test(textDocument.fileName);
                    return result;
                }
            }
        }

        function createServer(): Promise<StreamInfo> {
            return new Promise((resolve, reject) => {
                PortFinder.getPort((err, port) => {
                    Net.createServer(socket => {
                        log('Child process connected on port ' + port);

                        resolve({
                            reader: socket,
                            writer: socket
                        });
                    }).listen(port, () => {
                        let options = { 
                            cwd: VSCode.workspace.rootPath 
                        };
                        let child: ChildProcess.ChildProcess;
                        let fatJarFile = Path.resolve(context.extensionPath, 'target/vscode-manifest-yaml-0.0.1-SNAPSHOT.jar');
                        let args = [
                            '-Dserver.port=' + port,
                            '-jar',
                            fatJarFile,
                        ];
                        if (DEBUG) {
                            args.unshift(DEBUG_ARG);
                        }
                        log("CMD = "+javaExecutablePath + ' ' + args.join(' '));
                        
                        // Start the child java process
                        child = ChildProcess.execFile(javaExecutablePath, args, options);
                        child.stdout.on('data', (data) => {
                            log(""+data);
                        });
                        child.stderr.on('data', (data) => {
                            error(""+data);
                        })
                    });
                });
            });
        }

        // Create the language client and start the client.
        let client = new LanguageClient('manifest-yaml-extension', 'manifest-yaml-extension', 
            createServer, clientOptions);
        let disposable = client.start();

        // Push the disposable to the context's subscriptions so that the 
        // client can be deactivated on extension deactivation
        context.subscriptions.push(disposable);
    });
}

function isJava8(javaExecutablePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        let result = ChildProcess.execFile(javaExecutablePath, ['-version'], { }, (error, stdout, stderr) => {
            let eight = stderr.indexOf('1.8') >= 0;
            
            resolve(eight);
        });
    });
} 

function findJavaExecutable(binname: string) {
	binname = correctBinname(binname);

	// First search each JAVA_HOME bin folder
	if (process.env['JAVA_HOME']) {
		let workspaces = process.env['JAVA_HOME'].split(Path.delimiter);
		for (let i = 0; i < workspaces.length; i++) {
			let binpath = Path.join(workspaces[i], 'bin', binname);
			if (FS.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Then search PATH parts
	if (process.env['PATH']) {
		let pathparts = process.env['PATH'].split(Path.delimiter);
		for (let i = 0; i < pathparts.length; i++) {
			let binpath = Path.join(pathparts[i], binname);
			if (FS.existsSync(binpath)) {
				return binpath;
			}
		}
	}
    
	// Else return the binary name directly (this will likely always fail downstream) 
	return null;
}

function correctBinname(binname: string) {
	if (process.platform === 'win32')
		return binname + '.exe';
	else
		return binname;
}

// this method is called when your extension is deactivated
export function deactivate() {
}
