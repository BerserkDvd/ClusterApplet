#!/usr/bin/env python3
"""
kcoulomb.py — K-theoretic Coulomb Branch Algebra Toolkit (v0.2.0)

A single-file library for computing with K-theoretic Coulomb branch algebras,
as described in "Renormalization Group flow in Schur quantization"
(Ambrosino–Gaiotto, DESY-25-035).

All algebras are defined over Z[q, q^{-1}] with integer lattice charges.

Contents:
  1. QCoeff      — Laurent polynomials in q (coefficient ring)
  2. QTorus      — Quantum torus algebra Q_Γ
  3. QElement    — Elements (Laurent polys in X_γ) of Q_Γ
  4. Dilogarithm — E_q(X_γ) commutation and spectrum generators
  5. BPSQuiver   — Quiver mutations and spectrum generator search
  6. Algebras    — Concrete examples (q-Weyl, Pentagon, SU(2), SU(3), ...)
  7. Tests       — Self-test reproducing results from the paper

Run this file directly to execute all tests:
    python kcoulomb.py
"""

from __future__ import annotations
from collections import defaultdict
from fractions import Fraction
from typing import Optional
import functools


# ╔══════════════════════════════════════════════════════════════════╗
# ║  1. QCoeff — Laurent polynomials in q, elements of Z[q, q^{-1}] ║
# ╚══════════════════════════════════════════════════════════════════╝

class QCoeff:
    """An element of Z[q, q^{-1}]. Stored as {exponent: coefficient}."""

    __slots__ = ('_data',)

    def __init__(self, data: dict[int, int] | int = 0):
        if isinstance(data, int):
            self._data = {} if data == 0 else {0: data}
        elif isinstance(data, dict):
            self._data = {k: v for k, v in data.items() if v != 0}
        else:
            raise TypeError(f"Cannot construct QCoeff from {type(data)}")

    @staticmethod
    def one() -> QCoeff:
        return QCoeff({0: 1})

    @staticmethod
    def zero() -> QCoeff:
        return QCoeff({})

    @staticmethod
    def qpow(n: int) -> QCoeff:
        """Return q^n for integer n."""
        return QCoeff({n: 1})

    @staticmethod
    def q_integer(n: int) -> QCoeff:
        """[n]_q = q^{n-1} + q^{n-3} + ... + q^{1-n}."""
        if n == 0:
            return QCoeff.zero()
        sign = 1 if n > 0 else -1
        n = abs(n)
        data = {}
        for k in range(n):
            data[n - 1 - 2 * k] = data.get(n - 1 - 2 * k, 0) + sign
        return QCoeff(data)

    @staticmethod
    def q_factorial(n: int) -> QCoeff:
        """[n]_q! = [1]_q [2]_q ... [n]_q."""
        result = QCoeff.one()
        for k in range(1, n + 1):
            result = result * QCoeff.q_integer(k)
        return result

    @staticmethod
    @functools.lru_cache(maxsize=256)
    def q_binomial(n: int, k: int) -> QCoeff:
        """Gaussian binomial [n choose k]_q = [n]!/([k]![n-k]!)."""
        if k < 0 or k > n:
            return QCoeff.zero()
        if k == 0 or k == n:
            return QCoeff.one()
        num = QCoeff.q_factorial(n)
        den = QCoeff.q_factorial(k) * QCoeff.q_factorial(n - k)
        return num.exact_div(den)

    @property
    def is_zero(self) -> bool:
        return len(self._data) == 0

    @property
    def is_one(self) -> bool:
        return self._data == {0: 1}

    def __add__(self, other) -> QCoeff:
        if isinstance(other, int): other = QCoeff(other)
        if not isinstance(other, QCoeff): return NotImplemented
        result = dict(self._data)
        for k, v in other._data.items():
            result[k] = result.get(k, 0) + v
        return QCoeff(result)

    def __radd__(self, other):
        if isinstance(other, int): return self + QCoeff(other)
        return NotImplemented

    def __sub__(self, other) -> QCoeff:
        if isinstance(other, int): other = QCoeff(other)
        if not isinstance(other, QCoeff): return NotImplemented
        result = dict(self._data)
        for k, v in other._data.items():
            result[k] = result.get(k, 0) - v
        return QCoeff(result)

    def __neg__(self) -> QCoeff:
        return QCoeff({k: -v for k, v in self._data.items()})

    def __mul__(self, other) -> QCoeff:
        if isinstance(other, int):
            return QCoeff.zero() if other == 0 else QCoeff({k: v * other for k, v in self._data.items()})
        if isinstance(other, QCoeff):
            result = defaultdict(int)
            for k1, v1 in self._data.items():
                for k2, v2 in other._data.items():
                    result[k1 + k2] += v1 * v2
            return QCoeff(dict(result))
        return NotImplemented

    def __rmul__(self, other):
        if isinstance(other, int): return self * other
        return NotImplemented

    def shift(self, n: int) -> QCoeff:
        """Multiply by q^n."""
        return QCoeff({k + n: v for k, v in self._data.items()})

    def exact_div(self, other: QCoeff) -> QCoeff:
        """Exact Laurent polynomial division."""
        if other.is_zero: raise ZeroDivisionError
        if self.is_zero: return QCoeff.zero()
        num = dict(self._data)
        den_min = min(other._data.keys())
        den_lc = other._data[den_min]
        result = {}
        while num:
            num_min = min(num.keys())
            s = num_min - den_min
            c = num[num_min]
            if c % den_lc != 0:
                raise ValueError(f"Division not exact: {c} / {den_lc}")
            q = c // den_lc
            result[s] = q
            for k, v in other._data.items():
                key = k + s
                num[key] = num.get(key, 0) - v * q
                if num[key] == 0: del num[key]
        return QCoeff(result)

    def eval(self, q: complex) -> complex:
        """Evaluate at a specific numeric value of q."""
        return sum(coeff * q ** exp for exp, coeff in self._data.items())

    def __eq__(self, other) -> bool:
        if isinstance(other, int): other = QCoeff(other)
        if isinstance(other, QCoeff): return self._data == other._data
        return NotImplemented

    def __hash__(self) -> int:
        return hash(tuple(sorted(self._data.items())))

    def __repr__(self) -> str:
        if not self._data: return "0"
        terms = []
        for exp in sorted(self._data.keys()):
            c = self._data[exp]
            if exp == 0: terms.append(str(c))
            elif exp == 1:
                terms.append("q" if c == 1 else "-q" if c == -1 else f"{c}*q")
            else:
                s = f"q^{exp}"
                terms.append(s if c == 1 else f"-{s}" if c == -1 else f"{c}*{s}")
        return " + ".join(terms).replace(" + -", " - ")


# ╔══════════════════════════════════════════════════════════════════╗
# ║  2–3. QTorus & QElement — Quantum torus algebra and elements     ║
# ╚══════════════════════════════════════════════════════════════════╝

class QTorus:
    """Quantum torus algebra over Z^rank with integer antisymmetric pairing."""

    def __init__(self, pairing: list[list[int]]):
        self.rank = len(pairing)
        self.pairing = [list(row) for row in pairing]
        for i in range(self.rank):
            assert pairing[i][i] == 0
            for j in range(i + 1, self.rank):
                assert pairing[i][j] == -pairing[j][i]

    def pair(self, gamma: tuple[int, ...], gamma_prime: tuple[int, ...]) -> int:
        """Compute ⟨γ, γ'⟩. Always returns an integer."""
        result = 0
        for i in range(self.rank):
            for j in range(self.rank):
                result += self.pairing[i][j] * gamma[i] * gamma_prime[j]
        return result

    def X(self, *charges) -> QElement:
        """Create monomial X_γ."""
        if len(charges) == 1 and isinstance(charges[0], tuple):
            gamma = charges[0]
        else:
            gamma = tuple(charges)
        assert len(gamma) == self.rank
        assert all(isinstance(c, int) for c in gamma)
        return QElement(self, {gamma: QCoeff.one()})

    def zero(self) -> QElement:
        return QElement(self, {})

    def one(self) -> QElement:
        return self.X(*([0] * self.rank))

    def rho_Q(self, elem: QElement) -> QElement:
        """Canonical automorphism ρ_Q(X_γ) = X_{-γ}."""
        return QElement(self, {
            tuple(-x for x in gamma): coeff
            for gamma, coeff in elem._terms.items()
        })


class QElement:
    """A Laurent polynomial F = Σ_γ c_γ(q) X_γ in the quantum torus."""

    __slots__ = ('torus', '_terms')

    def __init__(self, torus: QTorus, terms: dict[tuple, QCoeff]):
        self.torus = torus
        self._terms = {k: v for k, v in terms.items() if not v.is_zero}

    @property
    def is_zero(self) -> bool:
        return len(self._terms) == 0

    @property
    def charges(self) -> list[tuple]:
        return sorted(self._terms.keys())

    @property
    def support(self) -> set[tuple]:
        return set(self._terms.keys())

    def coeff(self, gamma: tuple) -> QCoeff:
        return self._terms.get(gamma, QCoeff.zero())

    def num_terms(self) -> int:
        return len(self._terms)

    def __add__(self, other) -> QElement:
        if isinstance(other, (int, QCoeff)):
            c = QCoeff(other) if isinstance(other, int) else other
            zero = tuple(0 for _ in range(self.torus.rank))
            other = QElement(self.torus, {zero: c})
        if not isinstance(other, QElement): return NotImplemented
        result = dict(self._terms)
        for gamma, coeff in other._terms.items():
            result[gamma] = result.get(gamma, QCoeff.zero()) + coeff
        return QElement(self.torus, result)

    def __sub__(self, other) -> QElement:
        return self + (-other)

    def __neg__(self) -> QElement:
        return QElement(self.torus, {k: -v for k, v in self._terms.items()})

    def __mul__(self, other) -> QElement:
        if isinstance(other, (int, QCoeff)):
            c = QCoeff(other) if isinstance(other, int) else other
            return QElement(self.torus, {k: v * c for k, v in self._terms.items()})
        if isinstance(other, QElement):
            result: dict[tuple, QCoeff] = {}
            for g1, c1 in self._terms.items():
                for g2, c2 in other._terms.items():
                    p = self.torus.pair(g1, g2)
                    nc = tuple(a + b for a, b in zip(g1, g2))
                    new_coeff = c1 * c2 * QCoeff.qpow(p)
                    result[nc] = result.get(nc, QCoeff.zero()) + new_coeff
            return QElement(self.torus, result)
        return NotImplemented

    def __rmul__(self, other):
        if isinstance(other, (int, QCoeff)):
            c = QCoeff(other) if isinstance(other, int) else other
            return QElement(self.torus, {k: c * v for k, v in self._terms.items()})
        return NotImplemented

    def __eq__(self, other) -> bool:
        if isinstance(other, int) and other == 0: return self.is_zero
        if isinstance(other, QElement):
            return self.torus.rank == other.torus.rank and self._terms == other._terms
        return NotImplemented

    def __hash__(self):
        return hash(tuple(sorted((k, hash(v)) for k, v in self._terms.items())))

    def __repr__(self) -> str:
        if self.is_zero: return "0"
        parts = []
        for gamma in sorted(self._terms.keys()):
            c = self._terms[gamma]
            s = f"X_{gamma}"
            parts.append(s if c.is_one else f"({c}){s}")
        return " + ".join(parts)


def standard_rank2_torus() -> QTorus:
    """Rank-2 quantum torus with ⟨(a,b),(c,d)⟩ = ad - bc."""
    return QTorus([[0, 1], [-1, 0]])


# ╔══════════════════════════════════════════════════════════════════╗
# ║  4. Quantum Dilogarithm E_q(X_γ) and Spectrum Generators        ║
# ╚══════════════════════════════════════════════════════════════════╝

def pass_eq_right(torus: QTorus, eq_charge: tuple, mono_charge: tuple) -> QElement:
    """E_q(X_γ) · X_{γ'} = [result] · E_q(X_γ). Requires ⟨γ, γ'⟩ ≥ 0."""
    n = torus.pair(eq_charge, mono_charge)
    if n < 0:
        raise ValueError(f"Cannot pass E_q right: ⟨γ,γ'⟩ = {n} < 0")
    terms = {}
    for k in range(n + 1):
        nc = tuple(mono_charge[i] + k * eq_charge[i] for i in range(torus.rank))
        coeff = QCoeff.q_binomial(n, k)
        if not coeff.is_zero:
            terms[nc] = coeff
    return QElement(torus, terms)


def pass_eq_left(torus: QTorus, mono_charge: tuple, eq_charge: tuple) -> QElement:
    """X_{γ'} · E_q(X_γ) = E_q(X_γ) · [result]. Requires ⟨γ', γ⟩ ≥ 0."""
    m = torus.pair(mono_charge, eq_charge)
    if m < 0:
        raise ValueError(f"Cannot pass E_q left: ⟨γ',γ⟩ = {m} < 0")
    terms = {}
    for k in range(m + 1):
        nc = tuple(mono_charge[i] + k * eq_charge[i] for i in range(torus.rank))
        coeff = QCoeff.q_binomial(m, k)
        if not coeff.is_zero:
            terms[nc] = coeff
    return QElement(torus, terms)


def commute_eq_through_element_left(torus: QTorus, element: QElement,
                                     eq_charge: tuple) -> QElement:
    """F · E_q(X_γ) = E_q(X_γ) · G. Requires ⟨γ', γ⟩ ≥ 0 for all γ' in supp(F)."""
    result = torus.zero()
    for gp, coeff in element._terms.items():
        result = result + pass_eq_left(torus, gp, eq_charge) * coeff
    return result


class SpecGen:
    """Ordered product S = E_q(X_{γ₁}) · ... · E_q(X_{γ_n})."""

    def __init__(self, torus: QTorus, factors: list[tuple[tuple, int]]):
        self.torus = torus
        self.factors = list(factors)

    @classmethod
    def from_charges(cls, torus: QTorus, charges: list[tuple]) -> SpecGen:
        return cls(torus, [(c, 1) for c in charges])

    def commute_right(self, element: QElement) -> QElement:
        """Compute G such that F · S = S · G. Processes factors left to right."""
        result = element
        for charge, sign in self.factors:
            if sign == 1:
                result = commute_eq_through_element_left(self.torus, result, charge)
            else:
                raise NotImplementedError("Inverse dilogarithm commutation")
        return result

    def expand_numerical(self, q_val: float, max_degree: int) -> dict[tuple, complex]:
        """Expand S numerically at q=q_val, up to max_degree copies per factor."""
        zero = tuple(0 for _ in self.factors[0][0])
        result = {zero: 1.0}
        for charge, sign in self.factors:
            if sign != 1: raise NotImplementedError
            eq_coeffs = {tuple(0 for _ in charge): 1.0}
            pochhammer, num = 1.0, 1.0
            for n in range(1, max_degree + 1):
                num *= (-q_val)
                pochhammer *= (1.0 - q_val ** (2 * n))
                eq_coeffs[tuple(n * c for c in charge)] = num / pochhammer
            new_result = {}
            for g1, c1 in result.items():
                for g2, c2 in eq_coeffs.items():
                    p = self.torus.pair(g1, g2)
                    nc = tuple(a + b for a, b in zip(g1, g2))
                    new_result[nc] = new_result.get(nc, 0.0) + c1 * c2 * q_val ** p
            result = {k: v for k, v in new_result.items() if abs(v) > 1e-15}
        return result

    def verify_intertwining_numerical(self, F_a: QElement, rho_a: QElement,
                                       q_val=0.3, max_degree=10,
                                       compare_bound=4, tol=1e-10) -> bool:
        """Verify F_a · S = S · rho_a numerically on interior charges."""
        S_num = self.expand_numerical(q_val, max_degree)
        def mul_es(elem, sn):
            out = {}
            for gf, cf_q in elem._terms.items():
                cf = cf_q.eval(q_val)
                for gs, cs in sn.items():
                    p = self.torus.pair(gf, gs)
                    nc = tuple(a + b for a, b in zip(gf, gs))
                    out[nc] = out.get(nc, 0.0) + cf * cs * q_val ** p
            return out
        def mul_se(sn, elem):
            out = {}
            for gs, cs in sn.items():
                for gr, cr_q in elem._terms.items():
                    cr = cr_q.eval(q_val)
                    p = self.torus.pair(gs, gr)
                    nc = tuple(a + b for a, b in zip(gs, gr))
                    out[nc] = out.get(nc, 0.0) + cs * cr * q_val ** p
            return out
        lhs, rhs = mul_es(F_a, S_num), mul_se(S_num, rho_a)
        for gamma in set(lhs) | set(rhs):
            if all(abs(x) <= compare_bound for x in gamma):
                l, r = lhs.get(gamma, 0.0), rhs.get(gamma, 0.0)
                if abs(l - r) > tol * max(1, abs(l), abs(r)):
                    return False
        return True

    def __repr__(self) -> str:
        parts = []
        for charge, sign in self.factors:
            s = f"E_q(X_{charge})"
            parts.append(s if sign == 1 else s + "^(-1)")
        return " · ".join(parts)


# ╔══════════════════════════════════════════════════════════════════╗
# ║  5. BPS Quiver — mutations and spectrum generator search         ║
# ╚══════════════════════════════════════════════════════════════════╝

def _in_positive_cone(charge: tuple, generators: list[tuple]) -> bool:
    """Check if charge = Σ c_i generators[i] with all c_i ≥ 0."""
    n_gen = len(generators)
    if n_gen == 0:
        return all(x == 0 for x in charge)
    rank = len(charge)
    A = [[Fraction(generators[j][i]) for j in range(n_gen)] + [Fraction(charge[i])]
         for i in range(rank)]
    pivot_cols, row = [], 0
    for col in range(n_gen):
        pivot = None
        for r in range(row, rank):
            if A[r][col] != 0: pivot = r; break
        if pivot is None: continue
        pivot_cols.append(col)
        A[row], A[pivot] = A[pivot], A[row]
        for r in range(rank):
            if r == row: continue
            if A[r][col] != 0:
                factor = A[r][col] / A[row][col]
                for c in range(n_gen + 1): A[r][c] -= factor * A[row][c]
        row += 1
    for r in range(row, rank):
        if A[r][n_gen] != 0: return False
    coeffs = [Fraction(0)] * n_gen
    for idx, col in enumerate(pivot_cols):
        coeffs[col] = A[idx][n_gen] / A[idx][col]
    return all(c >= 0 for c in coeffs)


class BPSQuiver:
    """BPS quiver with charges and mutation operations."""

    def __init__(self, charges: list[tuple], frozen: Optional[list[bool]] = None,
                 exchange_matrix: Optional[list[list[int]]] = None):
        self.charges = [tuple(c) for c in charges]
        self.n_nodes = len(charges)
        self.frozen = frozen or [False] * self.n_nodes
        if exchange_matrix is not None:
            self.exchange = [list(row) for row in exchange_matrix]
        else:
            self.exchange = [[0] * self.n_nodes for _ in range(self.n_nodes)]

    @classmethod
    def from_pairing(cls, charges, pairing_matrix, frozen=None):
        """Create a quiver from charges and the ambient lattice pairing."""
        rank, n = len(charges[0]), len(charges)
        exchange = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                val = sum(pairing_matrix[a][b] * charges[i][a] * charges[j][b]
                          for a in range(rank) for b in range(rank))
                exchange[i][j] = int(val)
        return cls(charges, frozen, exchange)

    @property
    def arrows(self) -> list[tuple[int, int, int]]:
        result = []
        for i in range(self.n_nodes):
            for j in range(i + 1, self.n_nodes):
                v = self.exchange[i][j]
                if v > 0: result.append((i, j, v))
                elif v < 0: result.append((j, i, -v))
        return result

    def mutate(self, k: int) -> BPSQuiver:
        """Return a new quiver obtained by mutation at node k."""
        if self.frozen[k]:
            raise ValueError(f"Cannot mutate frozen node {k}")
        n = self.n_nodes
        new_exchange = [row[:] for row in self.exchange]
        new_charges = [list(c) for c in self.charges]
        rank = len(self.charges[0])
        for i in range(n):
            if i == k: continue
            for j in range(n):
                if j == k: continue
                new_exchange[i][j] = (self.exchange[i][j]
                    + max(0, self.exchange[i][k]) * max(0, self.exchange[k][j])
                    - max(0, -self.exchange[i][k]) * max(0, -self.exchange[k][j]))
        for i in range(n):
            if i != k:
                new_exchange[i][k] = -self.exchange[i][k]
                new_exchange[k][i] = -self.exchange[k][i]
        ck = list(self.charges[k])
        for j in range(n):
            if j == k:
                new_charges[j] = [-x for x in ck]
            else:
                shift = max(0, self.exchange[j][k])
                for a in range(rank):
                    new_charges[j][a] = self.charges[j][a] + shift * ck[a]
        return BPSQuiver([tuple(c) for c in new_charges], self.frozen[:], new_exchange)

    def mutation_sequence(self, seq: list[int]) -> BPSQuiver:
        q = self
        for k in seq: q = q.mutate(k)
        return q

    def find_negating_sequence(self, max_depth=20, allow_permutation=True):
        """BFS for a mutation sequence that negates all mutable charges,
        constrained to the positive cone of the ORIGINAL mutable charges."""
        from collections import deque
        initial_mutable = {i: tuple(c) for i, c in enumerate(self.charges)
                           if not self.frozen[i]}
        mutable_indices = sorted(initial_mutable.keys())
        original_generators = [initial_mutable[i] for i in mutable_indices]
        negated_set = frozenset(tuple(-x for x in c) for c in original_generators)
        def is_done(quiver):
            current_set = frozenset(quiver.charges[i] for i in mutable_indices)
            if allow_permutation:
                return current_set == negated_set
            else:
                return all(tuple(-x for x in initial_mutable[i]) == tuple(quiver.charges[i])
                           for i in mutable_indices)
        queue = deque([(self, [])])
        visited = set()
        visited.add(self._charge_key())
        while queue:
            current, path = queue.popleft()
            if len(path) > max_depth: return None
            if is_done(current): return path
            for k in mutable_indices:
                if not _in_positive_cone(current.charges[k], original_generators):
                    continue
                new_q = current.mutate(k)
                key = new_q._charge_key()
                if key not in visited:
                    visited.add(key)
                    queue.append((new_q, path + [k]))
        return None

    def build_spectrum_generator(self, seq: list[int]) -> list[tuple]:
        """Given a negating sequence, return the list of charges for S."""
        charges_for_S = []
        current = self
        for k in seq:
            charges_for_S.append(tuple(current.charges[k]))
            current = current.mutate(k)
        return charges_for_S

    def _charge_key(self) -> tuple:
        return tuple(tuple(c) for c in self.charges)

    def __repr__(self) -> str:
        lines = [f"BPSQuiver({self.n_nodes} nodes)"]
        for i, c in enumerate(self.charges):
            kind = "frozen" if self.frozen[i] else "mutable"
            lines.append(f"  [{i}] γ = {c}  ({kind})")
        for i, j, mult in self.arrows:
            lines.append(f"  {i} →{'→' * (mult-1)} {j}")
        return "\n".join(lines)


# ── Standard quiver constructors ──

def quiver_a1a2() -> BPSQuiver:
    """[A₁,A₂] Argyres-Douglas: two nodes, pairing 1."""
    return BPSQuiver.from_pairing([(1,0),(0,1)], [[0,1],[-1,0]])

def quiver_su2_pure() -> BPSQuiver:
    """Pure SU(2): two nodes, pairing 2."""
    return BPSQuiver.from_pairing([(1,0),(-1,2)], [[0,1],[-1,0]])

def quiver_su2_nf(nf: int) -> BPSQuiver:
    """SU(2) with N_f flavours."""
    n = 2 + nf
    exchange = [[0]*n for _ in range(n)]
    exchange[0][1] = 2; exchange[1][0] = -2
    for i in range(nf):
        mi = 2 + i
        exchange[1][mi] = 1; exchange[mi][1] = -1
        exchange[mi][0] = 1; exchange[0][mi] = -1
    charges = [tuple(1 if j==i else 0 for j in range(n)) for i in range(n)]
    return BPSQuiver(charges, [False]*n, exchange)

def quiver_su3_pure() -> BPSQuiver:
    """Pure SU(3): four nodes with pairings 2,1,2,1 around a cycle."""
    return BPSQuiver(
        charges=[(1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1)],
        frozen=[False]*4,
        exchange_matrix=[[0,2,0,-1],[-2,0,1,0],[0,-1,0,2],[1,0,-2,0]])


# ╔══════════════════════════════════════════════════════════════════╗
# ║  6. Concrete Algebras                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

class QWeylAlgebra:
    """q-Weyl algebra (SQED₁ Coulomb branch).
    Generators: u₊, u₋, v. Relations: u₊u₋=1+qv, u₋u₊=1+q⁻¹v."""
    def __init__(self):
        self.torus = standard_rank2_torus()
    def F_chart1(self):
        T = self.torus
        return {'v': T.X(0,1), 'u+': T.X(1,0),
                'u-': QElement(T, {(-1,0): QCoeff.one(), (-1,1): QCoeff.one()})}
    def F_chart2(self):
        T = self.torus
        return {'v': T.X(0,1),
                'u+': QElement(T, {(1,1): QCoeff.one(), (1,0): QCoeff.one()}),
                'u-': T.X(-1, 0)}
    def D_basis(self, a, b):
        T = self.torus
        if a <= 0: return QElement(T, {(a, b): QCoeff.one()})
        terms = {}
        for k in range(a + 1):
            c = QCoeff.q_binomial(a, k)
            if not c.is_zero: terms[(a, b+k)] = c
        return QElement(T, terms)
    def verify_relations(self):
        F, T = self.F_chart1(), self.torus
        return {
            'u+u-=1+qv': F['u+']*F['u-'] == T.one()+QCoeff.qpow(1)*F['v'],
            'u-u+=1+q⁻¹v': F['u-']*F['u+'] == T.one()+QCoeff.qpow(-1)*F['v'],
            'u+v=q²vu+': F['u+']*F['v'] == QCoeff.qpow(2)*(F['v']*F['u+']),
            'u-v=q⁻²vu-': F['u-']*F['v'] == QCoeff.qpow(-2)*(F['v']*F['u-'])}


class PentagonAlgebra:
    """Pentagon algebra ([A₁,A₂] Argyres-Douglas).
    5 generators L_i with Z₅ symmetry, ρ(L_i)=L_{i+2}."""
    def __init__(self):
        self.torus = standard_rank2_torus()
    def F_generators(self):
        T = self.torus
        return {
            'L0': T.X(1,0), 'L1': T.X(0,-1),
            'L2': QElement(T, {(-1,-1): QCoeff.one(), (-1,0): QCoeff.one()}),
            'L3': QElement(T, {(-1,0): QCoeff.one(), (-1,1): QCoeff.one(), (0,1): QCoeff.one()}),
            'L4': QElement(T, {(0,1): QCoeff.one(), (1,1): QCoeff.one()})}
    def spectrum_generator(self):
        return SpecGen.from_charges(self.torus, [(1,0),(0,1)])
    def spectrum_generator_alt(self):
        return SpecGen.from_charges(self.torus, [(0,1),(1,1),(1,0)])
    def verify_relations(self):
        F, T, results = self.F_generators(), self.torus, {}
        for i in range(5):
            Li, Lip, Lim = F[f'L{i}'], F[f'L{(i+1)%5}'], F[f'L{(i-1)%5}']
            results[f'L{(i+1)%5}L{i}=q²L{i}L{(i+1)%5}'] = Lip*Li == QCoeff.qpow(2)*(Li*Lip)
            results[f'L{(i+1)%5}L{(i-1)%5}=1+qL{i}'] = Lip*Lim == T.one()+QCoeff.qpow(1)*Li
        return results
    def verify_intertwining(self):
        F, S, T, results = self.F_generators(), self.spectrum_generator(), self.torus, {}
        for i in range(5):
            Li, rho_t = F[f'L{i}'], T.rho_Q(F[f'L{(i+2)%5}'])
            try:
                results[f'L{i}·S=S·ρ(L{(i+2)%5})'] = S.commute_right(Li) == rho_t
            except ValueError:
                results[f'L{i}·S=S·ρ(L{(i+2)%5})'] = S.verify_intertwining_numerical(Li, rho_t)
        return results


class SU2PureAlgebra:
    """Pure SU(2) Coulomb branch, restricted to integral sub-algebra."""
    def __init__(self):
        self.torus = standard_rank2_torus()
    def F_wilson(self):
        return QElement(self.torus, {(0,-1): QCoeff.one(), (-1,1): QCoeff.one(), (0,1): QCoeff.one()})
    def spectrum_generator(self):
        return SpecGen.from_charges(self.torus, [(1,0),(-1,2)])
    def verify_intertwining_wilson(self):
        w1 = self.F_wilson()
        return self.spectrum_generator().verify_intertwining_numerical(
            w1, self.torus.rho_Q(w1), q_val=0.3, max_degree=10, compare_bound=4)


# ╔══════════════════════════════════════════════════════════════════╗
# ║  7. Self-Tests                                                   ║
# ╚══════════════════════════════════════════════════════════════════╝

def run_tests():
    passed = failed = 0
    def check(name, cond):
        nonlocal passed, failed
        if cond: print(f"  ✓ {name}"); passed += 1
        else:    print(f"  ✗ {name}"); failed += 1

    T = standard_rank2_torus()
    cel = commute_eq_through_element_left

    print("\n═══ QCoeff ═══")
    check("[1]=1", QCoeff.q_integer(1) == QCoeff.one())
    check("[2]=q+q⁻¹", QCoeff.q_integer(2) == QCoeff({1:1,-1:1}))
    check("[3]=q²+1+q⁻²", QCoeff.q_integer(3) == QCoeff({2:1,0:1,-2:1}))
    check("[3 choose 2]=[3]", QCoeff.q_binomial(3,2) == QCoeff.q_integer(3))
    check("q·q⁻¹=1", QCoeff.qpow(1)*QCoeff.qpow(-1) == QCoeff.one())

    print("\n═══ Quantum Torus ═══")
    check("⟨(1,0),(0,1)⟩=1", T.pair((1,0),(0,1)) == 1)
    check("⟨(1,0),(-1,2)⟩=2", T.pair((1,0),(-1,2)) == 2)
    check("X₁₀·X₀₁=qX₁₁", T.X(1,0)*T.X(0,1) == QElement(T,{(1,1):QCoeff.qpow(1)}))
    check("ρ(X₁₀)=X₋₁₀", T.rho_Q(T.X(1,0)) == T.X(-1,0))

    print("\n═══ q-Weyl Algebra ═══")
    W = QWeylAlgebra()
    for name, ok in W.verify_relations().items(): check(name, ok)
    check("D₂₀ correct", W.D_basis(2,0) == QElement(T, {(2,0):QCoeff.one(),(2,1):QCoeff.q_integer(2),(2,2):QCoeff.one()}))

    print("\n═══ Dilogarithm Commutation ═══")
    check("pass left pairing 1", pass_eq_left(T,(1,0),(0,1)) == QElement(T,{(1,0):QCoeff.one(),(1,1):QCoeff.one()}))
    check("pass right pairing 2", pass_eq_right(T,(1,0),(-1,2)) == QElement(T,{(-1,2):QCoeff.one(),(0,2):QCoeff.q_integer(2),(1,2):QCoeff.one()}))

    print("\n═══ Pentagon Algebra ═══")
    P = PentagonAlgebra()
    for name, ok in P.verify_relations().items(): check(name, ok)
    for name, ok in P.verify_intertwining().items(): check(name, ok)
    FL = P.F_generators()
    check("L₀ through S = ρ(L₂)", cel(T, cel(T, FL['L0'], (1,0)), (0,1)) == T.rho_Q(FL['L2']))

    print("\n═══ BPS Quiver Mutations ═══")
    qa = quiver_a1a2()
    seq = qa.find_negating_sequence()
    check("A₂ seq found", seq is not None)
    check("A₂ S=[(1,0),(0,1)]", qa.build_spectrum_generator(seq) == [(1,0),(0,1)])

    qs = quiver_su2_pure()
    seq_s = qs.find_negating_sequence()
    check("SU(2) S=[(1,0),(-1,2)]", qs.build_spectrum_generator(seq_s) == [(1,0),(-1,2)])

    q1 = quiver_su2_nf(1)
    seq1 = q1.find_negating_sequence(max_depth=15, allow_permutation=True)
    check("Nf=1 seq found", seq1 is not None)

    q3 = quiver_su3_pure()
    seq3 = q3.find_negating_sequence(max_depth=15, allow_permutation=True)
    check("SU(3) seq found", seq3 is not None)
    if seq3:
        s3 = q3.build_spectrum_generator(seq3)
        expected = {(1,0,0,0),(0,0,1,0),(1,0,0,1),(0,1,1,0),(0,1,0,0),(0,0,0,1)}
        check("SU(3) 6 factors match paper", set(s3) == expected)

    print("\n═══ SU(2) Pure Intertwining ═══")
    SU2 = SU2PureAlgebra()
    check("w₁·S=S·ρ(w₁)", SU2.verify_intertwining_wilson())

    print("\n═══ Pentagon Identity ═══")
    S_alt = P.spectrum_generator_alt()
    for i in range(5):
        Li = FL[f'L{i}']
        rho_t = T.rho_Q(FL[f'L{(i+2)%5}'])
        check(f"Alt S: L{i}", S_alt.verify_intertwining_numerical(Li, rho_t, max_degree=15, compare_bound=3))

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed out of {passed+failed}")
    print(f"{'='*50}")
    return failed == 0


if __name__ == "__main__":
    run_tests()
