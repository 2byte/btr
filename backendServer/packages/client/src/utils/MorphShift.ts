export class MorphShift {
    private readonly shift: number;

    constructor(shift: number) {
        this.shift = shift;
    }

    to(text: string): string {
        return Array.from(text)
            .map(char => String.fromCharCode(char.charCodeAt(0) + this.shift))
            .join('');
    }

    from(text: string): string {
        return Array.from(text)
            .map(char => String.fromCharCode(char.charCodeAt(0) - this.shift))
            .join('');
    }
}