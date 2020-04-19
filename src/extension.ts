import { commands, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import { Command } from './common/constant';
import ServiceManager from './manager/serviceManager';
import { ParentNode } from './node/parentNode';
import { FileNode } from './node/fileNode';

export function activate(context: ExtensionContext) {

    const newLocal = vscode.ThemeColor.toString();
    console.log(newLocal)

    const serviceManager = new ServiceManager(context)

    context.subscriptions.push(
        ...serviceManager.init(),

        commands.registerCommand('ssh.add', () => serviceManager.provider.add()),
        commands.registerCommand('ssh.connection.terminal', (parentNode: ParentNode) => parentNode.openTerminal()),
        commands.registerCommand('ssh.connection.delete', (parentNode: ParentNode) => serviceManager.provider.delete(parentNode)),
        commands.registerCommand('ssh.file.delete', (node: ParentNode | FileNode) => node.delete()),
        commands.registerCommand('ssh.file.open', (fileNode: FileNode) => fileNode.open()),
        commands.registerCommand('ssh.file.download', (fileNode: FileNode) => fileNode.download()),
        commands.registerCommand(Command.REFRESH, () => serviceManager.provider.refresh()),
    )
}