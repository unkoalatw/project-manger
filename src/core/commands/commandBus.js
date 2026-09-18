/**
 * FlatSpec Command Bus & Global Undo/Redo Engine
 * 統一封裝所有實體寫入指令，提供全域撤銷/重做
 */

export class Command {
    async execute() { throw new Error('execute() must be implemented'); }
    async undo() { throw new Error('undo() must be implemented'); }
}

class CommandBus {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
    }

    async dispatch(command) {
        if (!command || typeof command.execute !== 'function') {
            throw new Error('Invalid command dispatched');
        }

        await command.execute();
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
        // 新指令執行時清空 redo stack
        this.redoStack = [];
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    async undo() {
        if (!this.canUndo()) return false;
        const cmd = this.undoStack.pop();
        if (typeof cmd.undo === 'function') {
            await cmd.undo();
            this.redoStack.push(cmd);
            return true;
        }
        return false;
    }

    async redo() {
        if (!this.canRedo()) return false;
        const cmd = this.redoStack.pop();
        if (typeof cmd.execute === 'function') {
            await cmd.execute();
            this.undoStack.push(cmd);
            return true;
        }
        return false;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export const commandBus = new CommandBus();

