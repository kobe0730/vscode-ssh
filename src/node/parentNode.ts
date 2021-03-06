import * as vscode from 'vscode';
import * as path from 'path';
import { FileEntry } from "ssh2-streams";
import { TreeItemCollapsibleState } from "vscode";
import { NodeType, Command } from "../common/constant";
import { ClientManager } from "../manager/clientManager";
import AbstractNode from "./abstracNode";
import { FileNode } from './fileNode';
import { SSHConfig } from "./sshConfig";
import { FileManager, FileModel } from '../manager/fileManager';
import ServiceManager from '../manager/serviceManager';


interface ParentModel {
    file: FileEntry;
    parentName: string;
    iconPath: string;
    nodeType: NodeType;
}

/**
 * contains connection and folder
 */
export class ParentNode extends AbstractNode {

    constructor(readonly sshConfig: SSHConfig, readonly name: string, readonly file?: FileEntry, readonly parentName?: string, iconPath?: string) {
        super(name, TreeItemCollapsibleState.Collapsed);
        this.id = file ? `${sshConfig.username}@${sshConfig.host}_${sshConfig.port}_${parentName}.${name}` : name;
        this.fullPath = this.parentName + this.name;
        if (!file) {
            this.contextValue = NodeType.CONNECTION;
            this.iconPath = path.join(__dirname, '..', '..', 'resources', 'image', `connection.svg`);
        } else {
            this.contextValue = NodeType.FOLDER;
            this.iconPath = path.join(__dirname, '..', '..', 'resources', 'image', `folder.svg`);
        }
        if (file && file.filename.toLocaleLowerCase() == "home") {
            this.iconPath = `${ServiceManager.context.extensionPath}/resources/image/folder-core.svg`;
        }else if (iconPath) {
            this.iconPath = iconPath;
        }
    }

    newFile(): any {
        vscode.window.showInputBox().then(async input => {
            if (input) {
                const { sftp } = await ClientManager.getSSH(this.sshConfig)
                const tempPath = await FileManager.record("temp/" + input, "", FileModel.WRITE);
                const targetPath = this.fullPath + "/" + input;
                sftp.fastPut(tempPath, targetPath, err => {
                    if (err) {
                        vscode.window.showErrorMessage(err.message)
                    } else {
                        vscode.commands.executeCommand(Command.REFRESH)
                    }
                })
            } else {
                vscode.window.showInformationMessage("Create File Cancel!")
            }
        })
    }

    newFolder(): any {
        vscode.window.showInputBox().then(async input => {
            if (input) {
                const { sftp } = await ClientManager.getSSH(this.sshConfig)
                sftp.mkdir(this.fullPath + "/" + input, err => {
                    if (err) {
                        vscode.window.showErrorMessage(err.message)
                    } else {
                        vscode.commands.executeCommand(Command.REFRESH)
                    }
                })
            } else {
                vscode.window.showInformationMessage("Create Folder Cancel!")
            }
        })
    }

    upload(): any {
        vscode.window.showOpenDialog({ canSelectFiles: true, canSelectMany: false, canSelectFolders: false, openLabel: "Select Download Path" })
            .then(async uri => {
                if (uri) {
                    const { sftp } = await ClientManager.getSSH(this.sshConfig)
                    const targetPath = uri[0].fsPath;
                    const start = new Date()
                    vscode.window.showInformationMessage(`Start uploading ${targetPath}.`)
                    sftp.fastPut(targetPath, this.fullPath + "/" + path.basename(targetPath), err => {
                        if (err) {
                            vscode.window.showErrorMessage(err.message)
                        } else {
                            vscode.window.showInformationMessage(`Upload ${this.fullPath} success, cost time: ${new Date().getTime() - start.getTime()}`)
                            vscode.commands.executeCommand(Command.REFRESH)
                        }
                    })
                }
            })
    }

    delete(): any {
        vscode.window.showQuickPick(["YES", "NO"], { canPickMany: false }).then(async str => {
            if (str == "YES") {
                const { sftp } = await ClientManager.getSSH(this.sshConfig)
                sftp.rmdir(this.fullPath, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage(err.message)
                    } else {
                        vscode.commands.executeCommand(Command.REFRESH)
                    }
                })
            }
        })
    }

    openTerminal(): any {
        const sendConfirm = "SEND PASSWORD";
        const sshterm = vscode.window.activeTerminal ? vscode.window.activeTerminal : vscode.window.createTerminal(this.name);
        sshterm.sendText(`ssh ${this.sshConfig.username}@${this.sshConfig.host} -o StrictHostKeyChecking=no ${this.sshConfig.private ? ` -i ${this.sshConfig.private}` : ''} `);
        sshterm.show();
        const auth = this.sshConfig.password || this.sshConfig.passphrase;
        if (auth) {
            vscode.window.showQuickPick([sendConfirm], { ignoreFocusOut: true }).then(res => {
                if (res == sendConfirm) {
                    sshterm.sendText(this.sshConfig.password)
                }
            })
        }

    }

    openInTeriminal(): any {
        if (!vscode.window.activeTerminal) {
            vscode.window.showErrorMessage("You must open terminal.")
        } else {
            vscode.window.activeTerminal.sendText(`cd ${this.fullPath}`)
        }
    }

    async getChildren(): Promise<AbstractNode[]> {

        const ssh = await ClientManager.getSSH(this.sshConfig)
        return new Promise((resolve) => {
            if (ssh == null) {
                resolve(null);
                return;
            }
            ssh.sftp.readdir(this.file ? this.parentName + this.name : '/', (err, fileList) => {
                if (err) {
                    resolve([]);
                    return;
                }
                const parent = this.file ? `${this.parentName + this.name}/` : '/';
                resolve(this.build(fileList, parent))
            })
        })
    }

    build(entryList: FileEntry[], parentName: string): AbstractNode[] {

        const folderList: ParentNode[] = []
        const fileList: FileNode[] = []

        for (const entry of entryList) {
            if (entry.longname.startsWith("d")) {
                folderList.push(new ParentNode(this.sshConfig, entry.filename, entry, parentName))
            } else if (entry.longname.startsWith("l")) {
                folderList.push(new ParentNode(this.sshConfig, entry.filename, entry, parentName))
            } else {
                fileList.push(new FileNode(this.sshConfig, entry, parentName))
            }
        }

        return [].concat(folderList.sort((a, b) => a.name.localeCompare(b.name)))
            .concat(fileList.sort((a, b) => a.file.filename.localeCompare(b.file.filename)));
    }

}
