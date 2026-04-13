import numpy as np
import matplotlib.pyplot as plt

def visibility(j):
    """Normalized linear-spin correlator visibility for spin-j."""
    return (j + 1) / (3 * j)

def phi_n(j, n):
    """Magnitude of the n-th order decoration for spin-j."""
    # Based on the derived relation: Phi^(n)_j ~ (V_j)^(n-1)
    # This represents the 'homotopical mass' of the n-party correlation.
    v = visibility(j)
    return v**(n - 1)

def plot_decoration_decay():
    # Range of spin j from 1/2 to 50
    j_values = np.linspace(0.5, 50, 200)
    
    # Party counts to compare: 2 (Whitehead), 3 (Jacobiator), 5, 10
    n_parties = [2, 3, 5, 10]
    
    plt.figure(figsize=(10, 6))
    
    for n in n_parties:
        phi_values = [phi_n(j, n) for j in j_values]
        label = f'n={n} ({ "Whitehead" if n==2 else "Jacobiator" if n==3 else str(n)+"-party"})'
        plt.plot(j_values, phi_values, label=label, linewidth=2)

    plt.axhline(y=1/3, color='gray', linestyle='--', alpha=0.5, label='Semiclassical Limit (n=2)')
    
    plt.title('Decay of Homotopical Decorations in the Spin-j Ladder', fontsize=14)
    plt.xlabel('Spin j', fontsize=12)
    plt.ylabel('Decoration Magnitude $\Phi^{(n)}_j$', fontsize=12)
    plt.yscale('log') # Log scale highlights the exponential separation
    plt.grid(True, which="both", ls="-", alpha=0.2)
    plt.legend()
    
    plt.tight_layout()
    plt.savefig('decoration_decay.png')
    print("Plot saved as decoration_decay.png")

if __name__ == "__main__":
    plot_decoration_decay()
