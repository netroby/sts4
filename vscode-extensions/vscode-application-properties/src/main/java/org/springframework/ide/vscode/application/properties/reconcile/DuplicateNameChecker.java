package org.springframework.ide.vscode.application.properties.reconcile;

import static org.springframework.ide.vscode.application.properties.reconcile.ApplicationPropertiesProblemType.PROP_DUPLICATE_KEY;
import static org.springframework.ide.vscode.application.properties.reconcile.SpringPropertyProblem.problem;

import java.util.HashMap;
import java.util.Map;

import org.springframework.ide.vscode.commons.languageserver.reconcile.IProblemCollector;
import org.springframework.ide.vscode.java.properties.parser.PropertiesAst.Key;

/**
 * Instance of this class is fed the regions of names in a properties file, checks them for duplicates and
 * reports the duplicates to {@link IProblemCollector}.
 *
 * @author Kris De Volder
 */
public class DuplicateNameChecker {

	/**
	 * Keep track of seen names. The value in the map entries is either null
	 * or the Region for the first time the name was seen.
	 * <p>
	 * This is used so that the first occurrence can still be reported retroactively
	 * when the second occurrence is encountered.
	 */
	private Map<String, Key> seen = new HashMap<>();

	IProblemCollector problems;

	public DuplicateNameChecker(IProblemCollector problems) {
		this.problems = problems;
	}

	public void check(Key nameRegion) {
		String name = nameRegion.decode();
		if (!name.isEmpty()) {
			if (seen.containsKey(name)) {
				Key pending = seen.get(name);
				if (pending!=null) {
					reportDuplicate(pending);
					seen.put(name, null);
				}
				reportDuplicate(nameRegion);
			} else {
				seen.put(name, nameRegion);
			}
		}
	}

	private void reportDuplicate(Key nameRegion) {
		String decodedKey = nameRegion.decode();
		problems.accept(problem(PROP_DUPLICATE_KEY,
				"Duplicate property '"+decodedKey+"'", nameRegion));
	}

}
