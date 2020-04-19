import * as path from 'path'
import * as vscode from 'vscode';
import { TreeItemCollapsibleState } from "vscode";
import AbstractNode from "./abstracNode";
import { SSHConfig } from "./sshConfig";
import { FileEntry } from "ssh2-streams";
import { ClientManager } from '../manager/clientManager';
import { Command } from '../common/constant';
import { NodeType } from "../common/constant";
const upath = require('upath');

export class FileNode extends AbstractNode {
    contextValue = NodeType.FILE;
    fullPath: string;
    constructor(readonly sshConfig: SSHConfig, readonly file: FileEntry, readonly parentName: string) {
        super(file.filename, TreeItemCollapsibleState.None)
        this.iconPath = path.join(__dirname, '..', '..', 'resources', 'image', `file.svg`);
        this.fullPath = this.parentName + this.file.filename;
        this.command = {
            command: "ssh.file.open",
            arguments: [this],
            title: "Open File"
        }
    }

    public async getChildren(): Promise<AbstractNode[]> {
        return [];
    }
    delete(): any {
        vscode.window.showQuickPick(["YES", "NO"], { canPickMany: false }).then(async str => {
            if (str == "YES") {
                const { sftp } = await ClientManager.getSSH(this.sshConfig)
                sftp.unlink(this.fullPath, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage(err)
                    } else {
                        vscode.commands.executeCommand(Command.REFRESH)
                    }
                })
            }
        })
    }
    async open() {
        const { sftp } = await ClientManager.getSSH(this.sshConfig)
        sftp.readFile(this.fullPath, async (err, buffer) => {
            if (err) {
                vscode.window.showErrorMessage(err)
            } else {
                const ext = path.extname(this.fullPath).replace(".", "");
                const language = this.getLanguageByExt(ext);
                vscode.window.showTextDocument(
                    await vscode.workspace.openTextDocument({ content: buffer.toString(), language })
                );
            }
        })
    }
    getLanguageByExt(ext: string): string {
        switch (ext) {
            case 'htm': return 'html';
        }
        return ext;
    }
    download(): any {

        vscode.window.showOpenDialog({ canSelectFiles: false, canSelectMany: false, canSelectFolders: true, openLabel: "Select Download Path" })
            .then(async uri => {
                if (uri) {
                    const { sftp } = await ClientManager.getSSH(this.sshConfig)
                    sftp.fastGet(this.fullPath, upath.toUnix(uri[0].fsPath), (err) => {
                        if (err) {
                            vscode.window.showErrorMessage(err.message)
                        }
                    })

                }
            })
    }
}