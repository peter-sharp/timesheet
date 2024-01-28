export  function playTripleBeep() {
        const ctx = new AudioContext()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        
        o.connect(g)
        o.type = "sine"
        g.connect(ctx.destination)
        
        o.start(0)
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0)
        g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.01)
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2)
        g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.21)
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.4)
        g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.41)
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.8)
}