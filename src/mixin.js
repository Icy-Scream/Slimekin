// Partial classes: one big class kept in several files (game.js + src/game/*.js, hud.js + src/ui/panels/*.js).
// A part is a plain class with methods only (no constructor, no fields, no `super`). mixParts copies each method (and
// getter) onto the target's prototype with its own flags, so inside it `this` is the Game or the Hud, exactly as when
// it was written in that class, and every caller keeps calling it by the same name. A name defined twice (in the class
// or in two parts) stops the game at load, so a part can never silently replace another method.
export function mixParts(Target, ...parts) {
  for (const Part of parts) {
    for (const key of Object.getOwnPropertyNames(Part.prototype)) {
      if (key === 'constructor') continue;
      if (Object.prototype.hasOwnProperty.call(Target.prototype, key)) throw new Error(`${Target.name}.${key} is defined twice (again in ${Part.name})`);
      Object.defineProperty(Target.prototype, key, Object.getOwnPropertyDescriptor(Part.prototype, key));
    }
  }
}
